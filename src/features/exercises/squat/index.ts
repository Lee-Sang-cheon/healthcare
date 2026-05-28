import type { ExerciseModule } from '../types';
import { useSquatSession } from './useSquatSession';

/**
 * The squat module — the only enabled exercise in V1. Adding a second
 * exercise means creating a sibling folder (e.g. `deadlift/`) with the same
 * shape and registering it in `exercises/registry.ts`.
 */
export const squatModule: ExerciseModule = {
  meta: {
    id: 'squat',
    name: '스쿼트',
    shortDescription: '깊이와 무릎 정렬을 측면 카메라로 분석합니다.',
    primaryCameraAngle: 'side',
    enabled: true,
  },
  useRuntime: ({ calibration }) => {
    const { state, onPose, getAllReps } = useSquatSession({ calibration });
    return { state, onPose, getAllReps };
  },
  issueLabels: {
    knee_valgus: '무릎 안쪽 모임',
    forward_lean: '상체 숙임',
    shallow_depth: '얕은 깊이',
    asymmetry: '좌우 비대칭',
    knee_varus: '무릎 벌어짐',
    tempo_too_fast: '너무 빠름',
  },
};
