import { angleFromVertical, midpoint } from './geometry';
import { type JointName, type PoseFrame } from './keypoints';

/**
 * Setup-time pre-flight checks before a workout starts.
 *
 * Squat analysis assumes:
 *   1. Full body visible in frame
 *   2. Camera mounted on the user's side (sagittal-plane parallel), not in front
 *   3. User is initially upright (so subsequent depth/tilt deltas are meaningful)
 *
 * These three are derived from a single PoseFrame — cheap to run per-frame
 * during setup, but the host hook decides when to consider them "stable".
 */

export type CheckStatus = 'ok' | 'warn';

export interface AlignmentCheck {
  status: CheckStatus;
  message: string;
}

export interface AlignmentChecks {
  framing: AlignmentCheck;
  cameraAngle: AlignmentCheck;
  posture: AlignmentCheck;
  /** All three are 'ok'. */
  ready: boolean;
}

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

const MIN_JOINT_SCORE = 0.4;
/** Joints must sit within the inner 92% of the frame to be considered uncropped. */
const FRAME_MARGIN = 0.04;
/**
 * Shoulder-to-shoulder distance, normalized by body height. When viewed from
 * the side, one shoulder hides the other so this ratio collapses to ~0.05–0.12.
 * From the front it's ~0.20+. We treat anything <= 0.18 as acceptable side view
 * to be forgiving of partial rotation.
 */
const SIDE_VIEW_RATIO_MAX = 0.18;
/** Trunk tilt (deg from vertical) that still counts as "standing upright". */
const UPRIGHT_TILT_MAX = 18;

const WARN: AlignmentCheck = { status: 'warn', message: '' };

export function checkAlignment(pose: PoseFrame): AlignmentChecks {
  // 1. Framing — every required joint has usable confidence AND sits inside
  //    the frame margin. Cropping makes downstream geometry unreliable.
  let framing: AlignmentCheck = { status: 'ok', message: '전신이 화면에 들어옴' };
  for (const j of REQUIRED_JOINTS) {
    const k = pose[j];
    if (k.score < MIN_JOINT_SCORE) {
      framing = { status: 'warn', message: '전신이 보이도록 거리를 조정하세요' };
      break;
    }
    if (
      k.x < FRAME_MARGIN ||
      k.x > 1 - FRAME_MARGIN ||
      k.y < FRAME_MARGIN ||
      k.y > 1 - FRAME_MARGIN
    ) {
      framing = { status: 'warn', message: '몸이 프레임 끝에 닿았습니다' };
      break;
    }
  }

  // The next two checks only make sense if framing is good.
  let cameraAngle: AlignmentCheck = { ...WARN, message: '카메라가 측면을 향하도록 두세요' };
  let posture: AlignmentCheck = { ...WARN, message: '바르게 서 주세요' };

  if (framing.status === 'ok') {
    // 2. Camera angle — side view collapses the shoulder span on screen.
    const shoulderSpan = Math.hypot(
      pose.leftShoulder.x - pose.rightShoulder.x,
      pose.leftShoulder.y - pose.rightShoulder.y,
    );
    const shoulderMid = midpoint(pose.leftShoulder, pose.rightShoulder);
    const ankleMid = midpoint(pose.leftAnkle, pose.rightAnkle);
    const bodyHeight = Math.hypot(shoulderMid.x - ankleMid.x, shoulderMid.y - ankleMid.y);
    const ratio = shoulderSpan / Math.max(bodyHeight, 1e-6);
    if (ratio <= SIDE_VIEW_RATIO_MAX) {
      cameraAngle = { status: 'ok', message: '카메라 측면 정렬 좋음' };
    }

    // 3. Posture — trunk near-vertical (so this baseline is meaningful when
    //    we measure deltas during the squat).
    const hipMid = midpoint(pose.leftHip, pose.rightHip);
    const tilt = angleFromVertical(hipMid, shoulderMid);
    if (tilt <= UPRIGHT_TILT_MAX) {
      posture = { status: 'ok', message: '서 있는 자세 OK' };
    }
  }

  return {
    framing,
    cameraAngle,
    posture,
    ready:
      framing.status === 'ok' && cameraAngle.status === 'ok' && posture.status === 'ok',
  };
}
