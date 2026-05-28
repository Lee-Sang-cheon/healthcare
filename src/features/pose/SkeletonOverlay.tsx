import { StyleSheet } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import type { JointName, PoseFrame } from './keypoints';

/**
 * Visual debug + user-facing skeleton drawn on top of the camera feed.
 *
 * Coordinate system: PoseFrame is normalized [0,1] in the camera *frame* space.
 * We render with a 100x100 viewBox and `preserveAspectRatio="none"` so the
 * overlay stretches to whatever container it sits in (e.g. absoluteFill on a
 * landscape camera). If the camera applies its own crop / aspect-fit, the
 * skeleton may drift — that lives under the camera-alignment open concern.
 */

const CONNECTIONS: ReadonlyArray<readonly [JointName, JointName]> = [
  ['leftShoulder', 'rightShoulder'],
  ['leftHip', 'rightHip'],
  ['leftShoulder', 'leftHip'],
  ['rightShoulder', 'rightHip'],
  ['leftShoulder', 'leftElbow'],
  ['leftElbow', 'leftWrist'],
  ['rightShoulder', 'rightElbow'],
  ['rightElbow', 'rightWrist'],
  ['leftHip', 'leftKnee'],
  ['leftKnee', 'leftAnkle'],
  ['rightHip', 'rightKnee'],
  ['rightKnee', 'rightAnkle'],
];

const JOINTS: readonly JointName[] = [
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

const MIN_SCORE = 0.3;

interface Props {
  pose: PoseFrame | null;
  /** Stroke / fill color (hex or rgba). */
  color?: string;
  /** Mirror horizontally — set when using the front camera. */
  mirror?: boolean;
}

export function SkeletonOverlay({ pose, color = '#FFFFFF', mirror = false }: Props) {
  if (!pose) return null;

  const mx = (x: number) => (mirror ? 100 - x * 100 : x * 100);
  const my = (y: number) => y * 100;

  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {CONNECTIONS.map(([a, b], i) => {
        const ka = pose[a];
        const kb = pose[b];
        if (ka.score < MIN_SCORE || kb.score < MIN_SCORE) return null;
        return (
          <Line
            key={`l${i}`}
            x1={mx(ka.x)}
            y1={my(ka.y)}
            x2={mx(kb.x)}
            y2={my(kb.y)}
            stroke={color}
            strokeWidth={0.8}
            strokeLinecap="round"
            opacity={0.9}
          />
        );
      })}
      {JOINTS.map((j) => {
        const k = pose[j];
        if (k.score < MIN_SCORE) return null;
        return <Circle key={j} cx={mx(k.x)} cy={my(k.y)} r={1.2} fill={color} />;
      })}
    </Svg>
  );
}
