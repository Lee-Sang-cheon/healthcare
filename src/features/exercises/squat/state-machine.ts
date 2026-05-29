import {
  analyzeSquatFrame,
  detectRepIssues,
  IssueSeverity,
  scoreRep,
  SquatThresholds,
  type SquatMetrics,
  type SquatThresholdSet,
} from './rules';
import type { PoseFrame } from '@/features/pose/keypoints';
import type { SquatIssue } from './issues';

/**
 * Rep state machine for squat. Walks STANDING → DESCENDING → BOTTOM → ASCENDING → STANDING (rep+1).
 *
 * Hysteresis: we need a sustained bottom of `bottomHoldFrames` frames to count
 * a real rep, so a quick jiggle near the bottom doesn't trigger.
 */

export type RepPhase = 'standing' | 'descending' | 'bottom' | 'ascending';

export interface RepResult {
  repNumber: number;
  formScore: number;
  issues: SquatIssue[];
  durationMs: number;
  worstMetrics: SquatMetrics;
}

export interface AnalyzerCallbacks {
  /** Fired once per completed rep (transition out of standing → through bottom → back to standing). */
  onRep?: (result: RepResult) => void;
  /** Fired any time an issue is detected during the descent. Cooldown per issue id (default 4s). */
  onIssue?: (issue: SquatIssue, metrics: SquatMetrics) => void;
}

export interface AnalyzerOptions {
  /** Frames the knee must stay below `kneeBottom` to confirm a real rep. ~6 @ 30fps = 200ms */
  bottomHoldFrames?: number;
  /** Per-issue cooldown for `onIssue`, in ms. */
  issueCooldownMs?: number;
  /**
   * Per-user threshold overrides. Anything omitted falls back to {@link SquatThresholds}.
   * Typically derived from `profiles.calibration` via `thresholdsFromCalibration`.
   */
  thresholds?: SquatThresholdSet;
}

interface InternalState {
  phase: RepPhase;
  repNumber: number;
  repStartTs: number | null;
  framesAtBottom: number;
  /** Worst metrics seen during current rep. "Worst" = lowest score components, recomputed per-axis. */
  worst: SquatMetrics | null;
  lastIssueTs: Map<SquatIssue, number>;
}

export function createSquatAnalyzer(callbacks: AnalyzerCallbacks = {}, options: AnalyzerOptions = {}) {
  const bottomHoldFrames = options.bottomHoldFrames ?? 6;
  const issueCooldownMs = options.issueCooldownMs ?? 4000;
  const thresholds: SquatThresholdSet = options.thresholds ?? { ...SquatThresholds };

  const state: InternalState = {
    phase: 'standing',
    repNumber: 0,
    repStartTs: null,
    framesAtBottom: 0,
    worst: null,
    lastIssueTs: new Map(),
  };

  function reset() {
    state.phase = 'standing';
    state.repNumber = 0;
    state.repStartTs = null;
    state.framesAtBottom = 0;
    state.worst = null;
    state.lastIssueTs.clear();
  }

  function mergeWorst(curr: SquatMetrics) {
    if (!state.worst) {
      state.worst = { ...curr };
      return;
    }
    // For each metric, keep the value that represents the rep's worst moment.
    // Knee angles: track the *minimum* (= deepest bend reached). The downstream
    // shallow-depth check is `worst.kneeAngle > shallowDepthBelow`, i.e. "even
    // at your deepest, were you still shallow?". Tracking max here would let
    // the ascent/standing frames (always ~180°) overwrite the real depth.
    // Hip angle is the same story.
    // Trunk tilt / asymmetry / cave: bigger = worse, so max-track is correct.
    state.worst = {
      reliable: state.worst.reliable && curr.reliable,
      kneeAngle: Math.min(state.worst.kneeAngle, curr.kneeAngle),
      leftKneeAngle: Math.min(state.worst.leftKneeAngle, curr.leftKneeAngle),
      rightKneeAngle: Math.min(state.worst.rightKneeAngle, curr.rightKneeAngle),
      hipAngle: Math.min(state.worst.hipAngle, curr.hipAngle),
      trunkTilt: Math.max(state.worst.trunkTilt, curr.trunkTilt),
      kneeAsymmetry: Math.max(state.worst.kneeAsymmetry, curr.kneeAsymmetry),
      kneeCaveIndex: Math.max(state.worst.kneeCaveIndex, curr.kneeCaveIndex),
    };
  }

  function maybeEmitIssue(metrics: SquatMetrics, nowMs: number) {
    if (!callbacks.onIssue) return;
    const issues = detectRepIssues(metrics, thresholds).sort(
      (a, b) => IssueSeverity[a] - IssueSeverity[b],
    );
    for (const issue of issues) {
      const last = state.lastIssueTs.get(issue) ?? 0;
      if (nowMs - last >= issueCooldownMs) {
        state.lastIssueTs.set(issue, nowMs);
        callbacks.onIssue(issue, metrics);
        // voice one issue per frame to avoid stepping on ourselves
        return;
      }
    }
  }

  function completeRep(nowMs: number) {
    if (!state.worst || state.repStartTs == null) return;
    const repNumber = state.repNumber + 1;
    const result: RepResult = {
      repNumber,
      formScore: scoreRep(state.worst, thresholds),
      issues: detectRepIssues(state.worst, thresholds),
      durationMs: nowMs - state.repStartTs,
      worstMetrics: state.worst,
    };
    state.repNumber = repNumber;
    state.worst = null;
    state.repStartTs = null;
    state.framesAtBottom = 0;
    callbacks.onRep?.(result);
  }

  function feed(pose: PoseFrame, nowMs = Date.now()): { metrics: SquatMetrics; phase: RepPhase; reps: number } {
    const metrics = analyzeSquatFrame(pose);

    if (!metrics.reliable) {
      return { metrics, phase: state.phase, reps: state.repNumber };
    }

    // Track worst-of-rep starting when we begin descending.
    if (state.phase !== 'standing') {
      mergeWorst(metrics);
      maybeEmitIssue(metrics, nowMs);
    }

    const knee = metrics.kneeAngle;

    switch (state.phase) {
      case 'standing': {
        if (knee < thresholds.kneeStanding - 5) {
          state.phase = 'descending';
          state.repStartTs = nowMs;
          state.framesAtBottom = 0;
          mergeWorst(metrics);
        }
        break;
      }
      case 'descending': {
        if (knee <= thresholds.kneeBottom) {
          state.framesAtBottom += 1;
          if (state.framesAtBottom >= bottomHoldFrames) state.phase = 'bottom';
        }
        break;
      }
      case 'bottom': {
        if (knee > thresholds.kneeBottom + 10) state.phase = 'ascending';
        break;
      }
      case 'ascending': {
        if (knee >= thresholds.kneeStanding) {
          completeRep(nowMs);
          state.phase = 'standing';
        }
        break;
      }
    }

    return { metrics, phase: state.phase, reps: state.repNumber };
  }

  function snapshot() {
    return { phase: state.phase, reps: state.repNumber };
  }

  return { feed, reset, snapshot };
}

export type SquatAnalyzer = ReturnType<typeof createSquatAnalyzer>;
