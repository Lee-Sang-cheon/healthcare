import { midpoint } from '@/features/pose/geometry';
import { jointsReliable, type JointName, type PoseFrame } from '@/features/pose/keypoints';

import { analyzeSquatFrame } from './rules';

/**
 * Standing baseline + body-proportion capture for calibration.
 *
 * Aggregates frames over a short window (usually 3s) while the user stands
 * relaxed. Discards unreliable frames; the caller decides how many samples
 * are "enough" to trust the baseline.
 */

const PROPORTION_JOINTS: readonly JointName[] = [
  'leftShoulder',
  'rightShoulder',
  'leftHip',
  'rightHip',
  'leftAnkle',
  'rightAnkle',
];

export interface StandingSample {
  kneeAngle: number;
  trunkTilt: number;
  asymmetry: number;
  kneeCaveIndex: number;
  /** leg length / torso length, derived from a single frame. */
  femurTorsoRatio: number;
}

export interface StandingBaseline {
  /** Number of frames averaged. The host UI can require >= some threshold. */
  sampleCount: number;
  minKneeAngle: number;
  neutralTrunkTilt: number;
  neutralAsymmetry: number;
  neutralKneeCaveIndex: number;
  femurTorsoRatio: number;
}

/**
 * Extract a single-frame standing sample. Returns null if the pose isn't
 * reliable enough or doesn't actually look like standing (knee bent).
 */
export function extractStandingSample(pose: PoseFrame): StandingSample | null {
  if (!jointsReliable(pose, PROPORTION_JOINTS)) return null;
  const metrics = analyzeSquatFrame(pose);
  if (!metrics.reliable) return null;
  // Reject if the user isn't actually standing — knees clearly bent.
  if (metrics.kneeAngle < 150) return null;

  const shoulderMid = midpoint(pose.leftShoulder, pose.rightShoulder);
  const hipMid = midpoint(pose.leftHip, pose.rightHip);
  const ankleMid = midpoint(pose.leftAnkle, pose.rightAnkle);
  const torsoLength = Math.hypot(shoulderMid.x - hipMid.x, shoulderMid.y - hipMid.y);
  const legLength = Math.hypot(hipMid.x - ankleMid.x, hipMid.y - ankleMid.y);
  const femurTorsoRatio = torsoLength > 1e-6 ? legLength / torsoLength : 1.0;

  return {
    kneeAngle: metrics.kneeAngle,
    trunkTilt: metrics.trunkTilt,
    asymmetry: metrics.kneeAsymmetry,
    kneeCaveIndex: metrics.kneeCaveIndex,
    femurTorsoRatio,
  };
}

/** Aggregate samples into a baseline. Returns null if no samples passed. */
export function buildStandingBaseline(samples: StandingSample[]): StandingBaseline | null {
  if (samples.length === 0) return null;
  const avg = (pick: (s: StandingSample) => number) =>
    samples.reduce((acc, s) => acc + pick(s), 0) / samples.length;

  return {
    sampleCount: samples.length,
    minKneeAngle: avg((s) => s.kneeAngle),
    neutralTrunkTilt: avg((s) => s.trunkTilt),
    neutralAsymmetry: avg((s) => s.asymmetry),
    neutralKneeCaveIndex: avg((s) => s.kneeCaveIndex),
    femurTorsoRatio: avg((s) => s.femurTorsoRatio),
  };
}
