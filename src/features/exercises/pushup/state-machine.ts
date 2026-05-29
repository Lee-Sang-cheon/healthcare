import type { PoseFrame } from '@/features/pose/keypoints';

import type { PushupIssue } from './issues';
import {
  analyzePushupFrame,
  detectRepIssues,
  IssueSeverity,
  PushupThresholds,
  scoreRep,
  type PushupMetrics,
  type PushupThresholdSet,
} from './rules';

/**
 * Pushup rep state machine. Walks PLANK → DESCENDING → BOTTOM → ASCENDING →
 * PLANK (rep+1), with a frames-at-bottom hold to dodge jitter.
 *
 * Mirrors the squat state machine; same shape, swapped metric.
 */

export type PushupPhase = 'plank' | 'descending' | 'bottom' | 'ascending';

export interface RepResult {
  repNumber: number;
  formScore: number;
  issues: PushupIssue[];
  durationMs: number;
  worstMetrics: PushupMetrics;
}

export interface AnalyzerCallbacks {
  onRep?: (result: RepResult) => void;
  onIssue?: (issue: PushupIssue, metrics: PushupMetrics) => void;
}

export interface AnalyzerOptions {
  bottomHoldFrames?: number;
  issueCooldownMs?: number;
  thresholds?: PushupThresholdSet;
}

interface InternalState {
  phase: PushupPhase;
  repNumber: number;
  repStartTs: number | null;
  framesAtBottom: number;
  worst: PushupMetrics | null;
  lastIssueTs: Map<PushupIssue, number>;
}

export function createPushupAnalyzer(callbacks: AnalyzerCallbacks = {}, options: AnalyzerOptions = {}) {
  const bottomHoldFrames = options.bottomHoldFrames ?? 6;
  const issueCooldownMs = options.issueCooldownMs ?? 4000;
  const thresholds: PushupThresholdSet = options.thresholds ?? { ...PushupThresholds };

  const state: InternalState = {
    phase: 'plank',
    repNumber: 0,
    repStartTs: null,
    framesAtBottom: 0,
    worst: null,
    lastIssueTs: new Map(),
  };

  function reset() {
    state.phase = 'plank';
    state.repNumber = 0;
    state.repStartTs = null;
    state.framesAtBottom = 0;
    state.worst = null;
    state.lastIssueTs.clear();
  }

  function mergeWorst(curr: PushupMetrics) {
    if (!state.worst) {
      state.worst = { ...curr };
      return;
    }
    state.worst = {
      reliable: state.worst.reliable && curr.reliable,
      // Elbow angle: track *minimum* (deepest descent). Symmetric reasoning
      // to the squat fix — max-tracking lets the lock-out frames pollute it.
      elbowAngle: Math.min(state.worst.elbowAngle, curr.elbowAngle),
      leftElbowAngle: Math.min(state.worst.leftElbowAngle, curr.leftElbowAngle),
      rightElbowAngle: Math.min(state.worst.rightElbowAngle, curr.rightElbowAngle),
      // Body line: track the largest *magnitude* deviation, preserving sign.
      bodyLineSignedDeviation:
        Math.abs(curr.bodyLineSignedDeviation) > Math.abs(state.worst.bodyLineSignedDeviation)
          ? curr.bodyLineSignedDeviation
          : state.worst.bodyLineSignedDeviation,
      elbowAsymmetry: Math.max(state.worst.elbowAsymmetry, curr.elbowAsymmetry),
    };
  }

  function maybeEmitIssue(metrics: PushupMetrics, nowMs: number) {
    if (!callbacks.onIssue) return;
    const issues = detectRepIssues(metrics, thresholds).sort(
      (a, b) => IssueSeverity[a] - IssueSeverity[b],
    );
    for (const issue of issues) {
      const last = state.lastIssueTs.get(issue) ?? 0;
      if (nowMs - last >= issueCooldownMs) {
        state.lastIssueTs.set(issue, nowMs);
        callbacks.onIssue(issue, metrics);
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

  function feed(pose: PoseFrame, nowMs = Date.now()): { metrics: PushupMetrics; phase: PushupPhase; reps: number } {
    const metrics = analyzePushupFrame(pose);

    if (!metrics.reliable) {
      return { metrics, phase: state.phase, reps: state.repNumber };
    }

    if (state.phase !== 'plank') {
      mergeWorst(metrics);
      maybeEmitIssue(metrics, nowMs);
    }

    const elbow = metrics.elbowAngle;

    switch (state.phase) {
      case 'plank': {
        if (elbow < thresholds.armLocked - 5) {
          state.phase = 'descending';
          state.repStartTs = nowMs;
          state.framesAtBottom = 0;
          mergeWorst(metrics);
        }
        break;
      }
      case 'descending': {
        if (elbow <= thresholds.armBent) {
          state.framesAtBottom += 1;
          if (state.framesAtBottom >= bottomHoldFrames) state.phase = 'bottom';
        }
        break;
      }
      case 'bottom': {
        if (elbow > thresholds.armBent + 10) state.phase = 'ascending';
        break;
      }
      case 'ascending': {
        if (elbow >= thresholds.armLocked) {
          completeRep(nowMs);
          state.phase = 'plank';
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

export type PushupAnalyzer = ReturnType<typeof createPushupAnalyzer>;
