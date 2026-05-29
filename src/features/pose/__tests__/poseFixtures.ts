import type { JointName, PoseFrame } from '../keypoints';

/**
 * Test fixture for building PoseFrames quickly. Default joints map a roughly
 * average adult standing upright in the right half of a portrait frame, viewed
 * from the side. Override any subset by passing keypoint patches.
 */

const DEFAULT_SCORE = 0.9;

// Even in a pure side view MoveNet emits slightly different x for the two
// shoulders/hips/knees/ankles, so we give them a tiny lateral spread.
// Without this, hipWidth → 0 and kneeCaveIndex (which divides by it) explodes.
const STANDING: PoseFrame = {
  nose: { x: 0.5, y: 0.1, score: DEFAULT_SCORE },
  leftShoulder: { x: 0.49, y: 0.22, score: DEFAULT_SCORE },
  rightShoulder: { x: 0.51, y: 0.22, score: DEFAULT_SCORE },
  leftElbow: { x: 0.48, y: 0.4, score: DEFAULT_SCORE },
  rightElbow: { x: 0.52, y: 0.4, score: DEFAULT_SCORE },
  leftWrist: { x: 0.47, y: 0.55, score: DEFAULT_SCORE },
  rightWrist: { x: 0.53, y: 0.55, score: DEFAULT_SCORE },
  leftHip: { x: 0.49, y: 0.5, score: DEFAULT_SCORE },
  rightHip: { x: 0.51, y: 0.5, score: DEFAULT_SCORE },
  // Standing → knee straight (hip→knee→ankle nearly collinear)
  leftKnee: { x: 0.49, y: 0.7, score: DEFAULT_SCORE },
  rightKnee: { x: 0.51, y: 0.7, score: DEFAULT_SCORE },
  leftAnkle: { x: 0.49, y: 0.9, score: DEFAULT_SCORE },
  rightAnkle: { x: 0.51, y: 0.9, score: DEFAULT_SCORE },
};

export function standingPose(overrides: Partial<PoseFrame> = {}): PoseFrame {
  return { ...STANDING, ...overrides };
}

/**
 * Deep squat — knee bent ~90°, ankle directly under knee (cave index ~0),
 * trunk leaned forward ~30°. Constructed so the geometry math actually
 * produces those values (otherwise tests would measure fixture mistakes,
 * not rule mistakes).
 */
const DEEP_SQUAT: PoseFrame = {
  ...STANDING,
  leftShoulder: { x: 0.14, y: 0.45, score: DEFAULT_SCORE },
  rightShoulder: { x: 0.16, y: 0.45, score: DEFAULT_SCORE },
  leftHip: { x: 0.29, y: 0.7, score: DEFAULT_SCORE },
  rightHip: { x: 0.31, y: 0.7, score: DEFAULT_SCORE },
  leftKnee: { x: 0.49, y: 0.7, score: DEFAULT_SCORE },
  rightKnee: { x: 0.51, y: 0.7, score: DEFAULT_SCORE },
  leftAnkle: { x: 0.49, y: 0.9, score: DEFAULT_SCORE },
  rightAnkle: { x: 0.51, y: 0.9, score: DEFAULT_SCORE },
};

export function deepSquatPose(overrides: Partial<PoseFrame> = {}): PoseFrame {
  return { ...DEEP_SQUAT, ...overrides };
}

/** Mid-descent — knee bent to ~124° (above shallow-depth threshold). */
export function midSquatPose(overrides: Partial<PoseFrame> = {}): PoseFrame {
  return {
    ...STANDING,
    leftHip: { x: 0.39, y: 0.6, score: DEFAULT_SCORE },
    rightHip: { x: 0.41, y: 0.6, score: DEFAULT_SCORE },
    leftKnee: { x: 0.54, y: 0.7, score: DEFAULT_SCORE },
    rightKnee: { x: 0.56, y: 0.7, score: DEFAULT_SCORE },
    leftAnkle: { x: 0.54, y: 0.9, score: DEFAULT_SCORE },
    rightAnkle: { x: 0.56, y: 0.9, score: DEFAULT_SCORE },
    ...overrides,
  };
}

/** Force every joint's score below a threshold (e.g. 0.1) — for reliability tests. */
export function unreliablePose(score = 0.1): PoseFrame {
  const joints: JointName[] = [
    'nose',
    'leftShoulder',
    'rightShoulder',
    'leftElbow',
    'rightElbow',
    'leftWrist',
    'rightWrist',
    'leftHip',
    'rightHip',
    'leftKnee',
    'rightKnee',
    'leftAnkle',
    'rightAnkle',
  ];
  const out = { ...STANDING };
  for (const j of joints) out[j] = { ...out[j], score };
  return out;
}
