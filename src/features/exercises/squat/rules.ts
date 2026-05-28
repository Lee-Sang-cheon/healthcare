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
 * Derive a per-user threshold set from personal calibration. The only knob
 * we currently personalize is `shallowDepthBelow`: anything shallower than
 * `personalMax + 15°` counts as a shallow rep.
 */
export function thresholdsFromCalibration(maxKneeAngle: number | undefined): SquatThresholdSet {
  const out: SquatThresholdSet = { ...SquatThresholds };
  if (maxKneeAngle != null && Number.isFinite(maxKneeAngle)) {
    // Clamp so the bar never lands above standing-detection or below kneeBottom.
    const candidate = maxKneeAngle + 15;
    out.shallowDepthBelow = Math.min(140, Math.max(SquatThresholds.kneeBottom + 5, candidate));
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
