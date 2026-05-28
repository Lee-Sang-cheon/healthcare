/**
 * Single source of truth for which exercises the app supports.
 * V1 MVP ships with squat only — everything else lives behind `enabled: false`.
 */

export type CameraAngle = 'side' | 'front';

export type ExerciseMeta = {
  id: string;
  name: string;
  shortDescription: string;
  primaryCameraAngle: CameraAngle;
  enabled: boolean;
};

export const exercises: ExerciseMeta[] = [
  {
    id: 'squat',
    name: '스쿼트',
    shortDescription: '깊이와 무릎 정렬을 측면 카메라로 분석합니다.',
    primaryCameraAngle: 'side',
    enabled: true,
  },
  {
    id: 'deadlift',
    name: '데드리프트',
    shortDescription: '척추 중립을 측면 카메라로 분석합니다.',
    primaryCameraAngle: 'side',
    enabled: false,
  },
  {
    id: 'pushup',
    name: '푸시업',
    shortDescription: '엉덩이 처짐과 팔꿈치 각도를 분석합니다.',
    primaryCameraAngle: 'side',
    enabled: false,
  },
];

export function getExercise(id: string): ExerciseMeta | undefined {
  return exercises.find((e) => e.id === id);
}
