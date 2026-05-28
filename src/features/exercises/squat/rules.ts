import { angleAt, angleFromVertical, midpoint } from '@/features/pose/geometry';
import { jointsReliable, type JointName, type PoseFrame } from '@/features/pose/keypoints';

import { SQUAT_ISSUE_SEVERITY, type SquatIssue } from './issues';

/**
 * Stateless analysis of a single pose frame for squat form.
 * The state machine (rep counting) lives in `state-machine.ts`.
 */

const REQUIRED_JOINTS: readonly JointName[] = [
  'leftShoulder',
  'rightShoulder',
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
  'leftAnkle',
  'rightAnkle',
];

export interface SquatMetrics {
  /** True if all required joints had usable scores. */
  reliable: boolean;
  /** Mean of left+right knee interior angles (deg). 180 = standing, ~70 = deep squat. */
  kneeAngle: number;
  leftKneeAngle: number;
  rightKneeAngle: number;
  /** Mean of left+right hip interior angles (shoulder-hip-knee). */
  hipAngle: number;
  /** Trunk tilt away from vertical (deg). 0 = upright, ~90 = bent fully forward. */
  trunkTilt: number;
  /** |left - right| knee angle difference. Proxy for asymmetry. */
  kneeAsymmetry: number;
  /**
   * Knee valgus indicator from a frontal view: positive value means the knee falls
   * *inside* the ankle (caving in), normalized by hip width.
   * Not meaningful from a pure side view.
   */
  kneeCaveIndex: number;
}

/** Thresholds tuned conservatively for 홈트 초보자 — don't nag too early. */
export const SquatThresholds = {
  kneeStanding: 160,
  kneeBottom: 95,
  shallowDepthBelow: 110,
  forwardLeanAbove: 55,
  asymmetryAbove: 18,
  kneeCaveAbove: 0.08,
} as const;

/** Mutable view used by the analyzer once any per-user overrides are merged in. */
export type SquatThresholdSet = { -readonly [K in keyof typeof SquatThresholds]: number };

/**
 * Reasonable allowed deviation from a user's standing baseline before we
 * call it a fault. Tuned for 홈트 초보자 — generous enough to not nag
 * users with unusual neutral posture.
 */
const BASELINE_OFFSETS = {
  /** °C of additional trunk tilt over the user's neutral. */
  trunkLean: 25,
  /** °C of additional left-right knee angle difference. */
  asymmetry: 12,
  /** Unitless cave index increment over neutral. */
  kneeCave: 0.05,
  /** ° shallower than the user's deepest squat that still counts as good depth. */
  shallowDepth: 15,
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface CalibrationInput {
  /** Smallest knee angle ever reached (deepest squat). */
  maxKneeAngle?: number;
  /** Knee angle while standing relaxed. */
  minKneeAngle?: number;
  neutralTrunkTilt?: number;
  neutralAsymmetry?: number;
  neutralKneeCaveIndex?: number;
  /** (leg length) / (torso length) — long femurs need more lean tolerance. */
  femurTorsoRatio?: number;
}

/**
 * Derive a per-user threshold set from personal calibration. Each threshold
 * collapses to the population default when the corresponding baseline field
 * is missing, so older calibrations (and no calibration) still work.
 */
export function thresholdsFromCalibration(cal: CalibrationInput | undefined): SquatThresholdSet {
  const out: SquatThresholdSet = { ...SquatThresholds };
  if (!cal) return out;

  // Standing knee angle → phase transition into 'standing'.
  if (cal.minKneeAngle != null && Number.isFinite(cal.minKneeAngle)) {
    out.kneeStanding = clamp(cal.minKneeAngle - 5, 140, 178);
  }

  // Deepest squat → both phase 'bottom' entry and shallow scoring threshold.
  if (cal.maxKneeAngle != null && Number.isFinite(cal.maxKneeAngle)) {
    out.kneeBottom = clamp(cal.maxKneeAngle + 10, 60, 130);
    out.shallowDepthBelow = clamp(
      cal.maxKneeAngle + BASELINE_OFFSETS.shallowDepth,
      out.kneeBottom + 5,
      140,
    );
  }

  // Trunk tilt — deviation from neutral, with extra leeway for long-femur folks.
  if (cal.neutralTrunkTilt != null && Number.isFinite(cal.neutralTrunkTilt)) {
    // femurTorsoRatio of 1.0 ≈ population average. Each 0.1 above adds 1.5° tolerance.
    const ratio = cal.femurTorsoRatio ?? 1.0;
    const ratioBonus = clamp((ratio - 1.0) * 15, -5, 10);
    out.forwardLeanAbove = clamp(
      cal.neutralTrunkTilt + BASELINE_OFFSETS.trunkLean + ratioBonus,
      25,
      75,
    );
  }

  // Left/right knee angle difference — deviation from natural neutral.
  if (cal.neutralAsymmetry != null && Number.isFinite(cal.neutralAsymmetry)) {
    out.asymmetryAbove = clamp(cal.neutralAsymmetry + BASELINE_OFFSETS.asymmetry, 8, 30);
  }

  // Knee cave / Q-angle proxy — deviation from baseline tracking.
  if (cal.neutralKneeCaveIndex != null && Number.isFinite(cal.neutralKneeCaveIndex)) {
    out.kneeCaveAbove = clamp(
      cal.neutralKneeCaveIndex + BASELINE_OFFSETS.kneeCave,
      0.03,
      0.2,
    );
  }

  return out;
}

const FALLBACK: SquatMetrics = {
  reliable: false,
  kneeAngle: 180,
  leftKneeAngle: 180,
  rightKneeAngle: 180,
  hipAngle: 180,
  trunkTilt: 0,
  kneeAsymmetry: 0,
  kneeCaveIndex: 0,
};

export function analyzeSquatFrame(pose: PoseFrame): SquatMetrics {
  if (!jointsReliable(pose, REQUIRED_JOINTS)) return FALLBACK;

  const ls = pose.leftShoulder;
  const rs = pose.rightShoulder;
  const lh = pose.leftHip;
  const rh = pose.rightHip;
  const lk = pose.leftKnee;
  const rk = pose.rightKnee;
  const la = pose.leftAnkle;
  const ra = pose.rightAnkle;

  const leftKneeAngle = angleAt(lh, lk, la);
  const rightKneeAngle = angleAt(rh, rk, ra);
  const leftHipAngle = angleAt(ls, lh, lk);
  const rightHipAngle = angleAt(rs, rh, rk);

  const shoulderMid = midpoint(ls, rs);
  const hipMid = midpoint(lh, rh);
  const trunkTilt = angleFromVertical(hipMid, shoulderMid);

  const hipWidth = Math.max(Math.hypot(lh.x - rh.x, lh.y - rh.y), 1e-6);
  const leftCave = (la.x - lk.x) / hipWidth;
  const rightCave = (rk.x - ra.x) / hipWidth;
  const kneeCaveIndex = Math.max(leftCave, rightCave);

  return {
    reliable: true,
    kneeAngle: (leftKneeAngle + rightKneeAngle) / 2,
    leftKneeAngle,
    rightKneeAngle,
    hipAngle: (leftHipAngle + rightHipAngle) / 2,
    trunkTilt,
    kneeAsymmetry: Math.abs(leftKneeAngle - rightKneeAngle),
    kneeCaveIndex,
  };
}

/**
 * 0..100 form score from a rep's worst-along-time metrics.
 * Deductions are gentle — a beginner reaching 110° depth still scores ~75.
 */
export function scoreRep(
  worst: SquatMetrics,
  thresholds: SquatThresholdSet = SquatThresholds,
): number {
  if (!worst.reliable) return 0;
  let score = 100;

  if (worst.kneeAngle > thresholds.shallowDepthBelow) {
    const over = worst.kneeAngle - thresholds.shallowDepthBelow;
    score -= Math.min(35, over * 1.2);
  }
  if (worst.trunkTilt > thresholds.forwardLeanAbove) {
    const over = worst.trunkTilt - thresholds.forwardLeanAbove;
    score -= Math.min(25, over * 1.0);
  }
  if (worst.kneeAsymmetry > thresholds.asymmetryAbove) {
    score -= Math.min(15, (worst.kneeAsymmetry - thresholds.asymmetryAbove) * 0.8);
  }
  if (worst.kneeCaveIndex > thresholds.kneeCaveAbove) {
    score -= Math.min(25, (worst.kneeCaveIndex - thresholds.kneeCaveAbove) * 200);
  }

  return Math.max(0, Math.round(score));
}

export function detectRepIssues(
  worst: SquatMetrics,
  thresholds: SquatThresholdSet = SquatThresholds,
): SquatIssue[] {
  if (!worst.reliable) return [];
  const issues: SquatIssue[] = [];
  if (worst.kneeCaveIndex > thresholds.kneeCaveAbove) issues.push('knee_valgus');
  if (worst.trunkTilt > thresholds.forwardLeanAbove) issues.push('forward_lean');
  if (worst.kneeAngle > thresholds.shallowDepthBelow) issues.push('shallow_depth');
  if (worst.kneeAsymmetry > thresholds.asymmetryAbove) issues.push('asymmetry');
  return issues;
}

/** Re-export severity map so state-machine doesn't pull a sibling import. */
export const IssueSeverity = SQUAT_ISSUE_SEVERITY;
