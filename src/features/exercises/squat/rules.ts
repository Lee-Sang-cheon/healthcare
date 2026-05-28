import { angleAt, angleFromVertical, midpoint } from '@/features/pose/geometry';
import { jointsReliable, type JointName, type PoseFrame } from '@/features/pose/keypoints';
import type { FormIssue } from '@/lib/supabase/types';

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
export function scoreRep(worst: SquatMetrics): number {
  if (!worst.reliable) return 0;
  let score = 100;

  if (worst.kneeAngle > SquatThresholds.shallowDepthBelow) {
    const over = worst.kneeAngle - SquatThresholds.shallowDepthBelow;
    score -= Math.min(35, over * 1.2);
  }
  if (worst.trunkTilt > SquatThresholds.forwardLeanAbove) {
    const over = worst.trunkTilt - SquatThresholds.forwardLeanAbove;
    score -= Math.min(25, over * 1.0);
  }
  if (worst.kneeAsymmetry > SquatThresholds.asymmetryAbove) {
    score -= Math.min(15, (worst.kneeAsymmetry - SquatThresholds.asymmetryAbove) * 0.8);
  }
  if (worst.kneeCaveIndex > SquatThresholds.kneeCaveAbove) {
    score -= Math.min(25, (worst.kneeCaveIndex - SquatThresholds.kneeCaveAbove) * 200);
  }

  return Math.max(0, Math.round(score));
}

export function detectRepIssues(worst: SquatMetrics): FormIssue[] {
  if (!worst.reliable) return [];
  const issues: FormIssue[] = [];
  if (worst.kneeCaveIndex > SquatThresholds.kneeCaveAbove) issues.push('knee_valgus');
  if (worst.trunkTilt > SquatThresholds.forwardLeanAbove) issues.push('forward_lean');
  if (worst.kneeAngle > SquatThresholds.shallowDepthBelow) issues.push('shallow_depth');
  if (worst.kneeAsymmetry > SquatThresholds.asymmetryAbove) issues.push('asymmetry');
  return issues;
}

/** Severity ordering — first item should be voiced first. */
export const IssueSeverity: Record<FormIssue, number> = {
  knee_valgus: 1,
  forward_lean: 2,
  shallow_depth: 3,
  asymmetry: 4,
  knee_varus: 5,
  tempo_too_fast: 6,
};
