import { angleAt, midpoint } from '@/features/pose/geometry';
import { jointsReliable, type JointName, type PoseFrame } from '@/features/pose/keypoints';

import { PUSHUP_ISSUE_SEVERITY, type PushupIssue } from './issues';

/**
 * Pushup analysis. Side-view assumption like squat: the user is filmed from
 * the side, so left and right joints overlap. We aggregate left+right into
 * single metrics.
 *
 * Body line = shoulder → hip → ankle. In a clean plank position this triple
 * is collinear (interior angle at hip ≈ 180°). Sag drops the hip below the
 * line (interior angle < 165°); pike raises it (interior angle still < 180°
 * but the trunk-trunk angle goes the other way — we use signed deviation
 * from straight to distinguish).
 */

const REQUIRED_JOINTS: readonly JointName[] = [
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftHip',
  'rightHip',
  'leftAnkle',
  'rightAnkle',
];

export interface PushupMetrics {
  reliable: boolean;
  /** Mean of left+right elbow interior angles. 180° = arms straight, ~80° = chest near floor. */
  elbowAngle: number;
  leftElbowAngle: number;
  rightElbowAngle: number;
  /**
   * Signed deviation of the shoulder-hip-ankle line from a straight body.
   * 0 = perfectly straight plank. Positive = sag (hip below line). Negative
   * = pike (hip above line).
   */
  bodyLineSignedDeviation: number;
  /** |left - right| elbow asymmetry, deg. */
  elbowAsymmetry: number;
}

export const PushupThresholds = {
  /** Above this elbow angle = plank phase (arms locked out). */
  armLocked: 160,
  /** Below this = chest near floor (bottom of rep). */
  armBent: 95,
  /** Elbow shallower than this is flagged as shallow_depth. */
  shallowDepthBelow: 115,
  /** Positive deviation above this = hip_sag. */
  hipSagAbove: 12,
  /** Negative deviation below -this = hip_pike. */
  hipPikeBelow: 12,
} as const;

export type PushupThresholdSet = { -readonly [K in keyof typeof PushupThresholds]: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const FALLBACK: PushupMetrics = {
  reliable: false,
  elbowAngle: 180,
  leftElbowAngle: 180,
  rightElbowAngle: 180,
  bodyLineSignedDeviation: 0,
  elbowAsymmetry: 0,
};

export function analyzePushupFrame(pose: PoseFrame): PushupMetrics {
  if (!jointsReliable(pose, REQUIRED_JOINTS)) return FALLBACK;

  const ls = pose.leftShoulder;
  const rs = pose.rightShoulder;
  const le = pose.leftElbow;
  const re = pose.rightElbow;
  const lw = pose.leftWrist;
  const rw = pose.rightWrist;
  const lh = pose.leftHip;
  const rh = pose.rightHip;
  const la = pose.leftAnkle;
  const ra = pose.rightAnkle;

  const leftElbowAngle = angleAt(ls, le, lw);
  const rightElbowAngle = angleAt(rs, re, rw);

  const shoulderMid = midpoint(ls, rs);
  const hipMid = midpoint(lh, rh);
  const ankleMid = midpoint(la, ra);

  // Hip interior angle (shoulder-hip-ankle). 180° = straight. The sign tells
  // sag vs pike: project the hip displacement onto the perpendicular of the
  // shoulder→ankle axis.
  const interior = angleAt(shoulderMid, hipMid, ankleMid);
  const deviationMagnitude = 180 - interior;

  // Determine sign: which side of the shoulder→ankle line does the hip sit?
  // In image coords y grows downward. A hip *below* the line (sag) has a
  // positive cross product with the down direction.
  const sx = ankleMid.x - shoulderMid.x;
  const sy = ankleMid.y - shoulderMid.y;
  const hx = hipMid.x - shoulderMid.x;
  const hy = hipMid.y - shoulderMid.y;
  const cross = sx * hy - sy * hx;
  const sign = cross >= 0 ? 1 : -1;
  const bodyLineSignedDeviation = sign * deviationMagnitude;

  return {
    reliable: true,
    elbowAngle: (leftElbowAngle + rightElbowAngle) / 2,
    leftElbowAngle,
    rightElbowAngle,
    bodyLineSignedDeviation,
    elbowAsymmetry: Math.abs(leftElbowAngle - rightElbowAngle),
  };
}

export function scoreRep(
  worst: PushupMetrics,
  thresholds: PushupThresholdSet = PushupThresholds,
): number {
  if (!worst.reliable) return 0;
  let score = 100;

  if (worst.elbowAngle > thresholds.shallowDepthBelow) {
    const over = worst.elbowAngle - thresholds.shallowDepthBelow;
    score -= Math.min(35, over * 1.2);
  }
  if (worst.bodyLineSignedDeviation > thresholds.hipSagAbove) {
    score -= Math.min(25, (worst.bodyLineSignedDeviation - thresholds.hipSagAbove) * 1.0);
  } else if (worst.bodyLineSignedDeviation < -thresholds.hipPikeBelow) {
    score -= Math.min(25, (-worst.bodyLineSignedDeviation - thresholds.hipPikeBelow) * 1.0);
  }
  if (worst.elbowAsymmetry > 18) {
    score -= Math.min(15, (worst.elbowAsymmetry - 18) * 0.8);
  }

  return Math.max(0, Math.round(score));
}

export function detectRepIssues(
  worst: PushupMetrics,
  thresholds: PushupThresholdSet = PushupThresholds,
): PushupIssue[] {
  if (!worst.reliable) return [];
  const issues: PushupIssue[] = [];
  if (worst.bodyLineSignedDeviation > thresholds.hipSagAbove) issues.push('hip_sag');
  if (worst.bodyLineSignedDeviation < -thresholds.hipPikeBelow) issues.push('hip_pike');
  if (worst.elbowAngle > thresholds.shallowDepthBelow) issues.push('shallow_depth');
  return issues;
}

export const IssueSeverity = PUSHUP_ISSUE_SEVERITY;

interface CalibrationInput {
  /** Deepest elbow angle reached (smallest); used to personalize shallow bar. */
  minElbowAngle?: number;
}

export function thresholdsFromCalibration(cal: CalibrationInput | undefined): PushupThresholdSet {
  const out: PushupThresholdSet = { ...PushupThresholds };
  if (!cal) return out;
  if (cal.minElbowAngle != null && Number.isFinite(cal.minElbowAngle)) {
    out.armBent = clamp(cal.minElbowAngle + 10, 60, 130);
    out.shallowDepthBelow = clamp(cal.minElbowAngle + 15, out.armBent + 5, 150);
  }
  return out;
}
