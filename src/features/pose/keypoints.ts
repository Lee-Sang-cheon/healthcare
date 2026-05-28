/**
 * Model-agnostic pose representation.
 *
 * Pose models (MoveNet, BlazePose, ...) emit landmarks in their own index
 * order. To avoid leaking that into the rule engine, every model goes through
 * an adapter (`movenet-adapter.ts`, etc.) that produces this normalized
 * structure first. Squat rules only care about 8 joints — anything else lives
 * in `other` for future exercises.
 */

export interface Keypoint {
  /** Image-space x. Normalized [0,1] or pixels — math works either way. */
  x: number;
  /** Image-space y. Normalized [0,1] or pixels. */
  y: number;
  /** Model confidence in [0,1]. */
  score: number;
}

export type JointName =
  | 'nose'
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftElbow'
  | 'rightElbow'
  | 'leftWrist'
  | 'rightWrist'
  | 'leftHip'
  | 'rightHip'
  | 'leftKnee'
  | 'rightKnee'
  | 'leftAnkle'
  | 'rightAnkle';

export type PoseFrame = Readonly<Record<JointName, Keypoint>>;

const EMPTY: Keypoint = { x: 0, y: 0, score: 0 };

export function emptyPose(): PoseFrame {
  return {
    nose: EMPTY,
    leftShoulder: EMPTY,
    rightShoulder: EMPTY,
    leftElbow: EMPTY,
    rightElbow: EMPTY,
    leftWrist: EMPTY,
    rightWrist: EMPTY,
    leftHip: EMPTY,
    rightHip: EMPTY,
    leftKnee: EMPTY,
    rightKnee: EMPTY,
    leftAnkle: EMPTY,
    rightAnkle: EMPTY,
  };
}

/** Whether the given joints all have confidence above `minScore`. */
export function jointsReliable(
  pose: PoseFrame,
  joints: readonly JointName[],
  minScore = 0.4,
): boolean {
  for (const j of joints) {
    if (pose[j].score < minScore) return false;
  }
  return true;
}
