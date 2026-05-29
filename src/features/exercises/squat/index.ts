import type { ExerciseModule } from '../types';

import { SQUAT_ISSUE_LABELS, SQUAT_ISSUE_VOICE, type SquatIssue } from './issues';
import { useSquatSession } from './useSquatSession';

/**
 * The squat module — the only enabled exercise in V1. Adding a second
 * exercise means creating a sibling folder (e.g. `deadlift/`) with the same
 * shape and registering it in `exercises/registry.ts`.
 */
export const squatModule: ExerciseModule<SquatIssue> = {
  meta: {
    id: 'squat',
    name: '스쿼트',
    shortDescription: '깊이와 무릎 정렬을 측면 카메라로 분석합니다.',
    primaryCameraAngle: 'side',
    enabled: true,
  },
  useRuntime: ({ calibration }) => {
    const { state, onPose, getAllReps } = useSquatSession({ calibration: calibration?.squat ?? null });
    return { state, onPose, getAllReps };
  },
  issueLabels: SQUAT_ISSUE_LABELS,
  voicePrompts: SQUAT_ISSUE_VOICE,
};

export type { SquatIssue } from './issues';
