import type { JointName, PoseFrame } from './keypoints';

/**
 * MoveNet Lightning / Thunder output → our normalized PoseFrame.
 *
 * MoveNet returns a single tensor of shape [1, 1, 17, 3] where the last axis is
 * [y, x, score] in normalized [0,1] image space (note the y-then-x order).
 *
 * COCO 17-keypoint indices (https://github.com/tensorflow/tfjs-models/tree/master/pose-detection):
 *   0:nose 1:l_eye 2:r_eye 3:l_ear 4:r_ear
 *   5:l_shoulder 6:r_shoulder 7:l_elbow 8:r_elbow 9:l_wrist 10:r_wrist
 *   11:l_hip 12:r_hip 13:l_knee 14:r_knee 15:l_ankle 16:r_ankle
 */

const COCO_INDEX: Record<JointName, number> = {
  nose: 0,
  leftShoulder: 5,
  rightShoulder: 6,
  leftElbow: 7,
  rightElbow: 8,
  leftWrist: 9,
  rightWrist: 10,
  leftHip: 11,
  rightHip: 12,
  leftKnee: 13,
  rightKnee: 14,
  leftAnkle: 15,
  rightAnkle: 16,
};

/**
 * Parse a flat Float32Array of length 51 (= 17 * 3) into a PoseFrame.
 * Worklet-safe: no Maps, no allocations besides the returned object.
 */
export function movenetToPose(out: Float32Array | number[]): PoseFrame {
  'worklet';
  const read = (i: number) => {
    const base = i * 3;
    return { y: out[base], x: out[base + 1], score: out[base + 2] };
  };
  const at = (i: number) => {
    const { x, y, score } = read(i);
    return { x, y, score };
  };

  return {
    nose: at(COCO_INDEX.nose),
    leftShoulder: at(COCO_INDEX.leftShoulder),
    rightShoulder: at(COCO_INDEX.rightShoulder),
    leftElbow: at(COCO_INDEX.leftElbow),
    rightElbow: at(COCO_INDEX.rightElbow),
    leftWrist: at(COCO_INDEX.leftWrist),
    rightWrist: at(COCO_INDEX.rightWrist),
    leftHip: at(COCO_INDEX.leftHip),
    rightHip: at(COCO_INDEX.rightHip),
    leftKnee: at(COCO_INDEX.leftKnee),
    rightKnee: at(COCO_INDEX.rightKnee),
    leftAnkle: at(COCO_INDEX.leftAnkle),
    rightAnkle: at(COCO_INDEX.rightAnkle),
  };
}

/** Input resolution MoveNet Lightning expects. */
export const MOVENET_LIGHTNING_INPUT = 192;
/** Input resolution MoveNet Thunder expects. */
export const MOVENET_THUNDER_INPUT = 256;
