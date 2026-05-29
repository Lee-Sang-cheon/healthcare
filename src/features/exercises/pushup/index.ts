import type { ExerciseModule } from '../types';

import { PUSHUP_ISSUE_LABELS, PUSHUP_ISSUE_VOICE, type PushupIssue } from './issues';
import { usePushupSession } from './usePushupSession';

export const pushupModule: ExerciseModule<PushupIssue> = {
  meta: {
    id: 'pushup',
    name: '푸시업',
    shortDescription: '엉덩이 처짐과 팔꿈치 각도를 측면 카메라로 분석합니다.',
    primaryCameraAngle: 'side',
    enabled: true,
  },
  useRuntime: ({ calibration }) => {
    // Pushup calibration is squat-shaped today (a single field). When we add
    // a real `cal.pushup` slice, swap this lookup; until then the module
    // simply ignores incoming calibration.
    const { state, onPose, getAllReps, reset } = usePushupSession({
      calibration: null,
    });
    // Suppress unused — `calibration` will be consumed once a pushup
    // calibration screen exists.
    void calibration;
    return { state, onPose, getAllReps, reset };
  },
  issueLabels: PUSHUP_ISSUE_LABELS,
  voicePrompts: PUSHUP_ISSUE_VOICE,
};

export type { PushupIssue } from './issues';
