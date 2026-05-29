import { useCallback, useMemo, useRef, useState } from 'react';
import * as Speech from 'expo-speech';

import type { PoseFrame } from '@/features/pose/keypoints';

import { PUSHUP_ISSUE_VOICE, type PushupIssue } from './issues';
import { thresholdsFromCalibration } from './rules';
import type { RepResult } from './state-machine';
import { createPushupAnalyzer } from './state-machine';

export interface PushupSessionState {
  reps: number;
  lastRep: RepResult | null;
  lastIssue: PushupIssue | null;
  formColor: 'good' | 'warn' | 'danger';
}

export interface UsePushupSessionOptions {
  /** Optional personal calibration (currently just `minElbowAngle`). */
  calibration?: { minElbowAngle: number; recordedAt?: string } | null;
}

export function usePushupSession(options: UsePushupSessionOptions = {}) {
  const { calibration } = options;

  const [reps, setReps] = useState(0);
  const [lastRep, setLastRep] = useState<RepResult | null>(null);
  const [lastIssue, setLastIssue] = useState<PushupIssue | null>(null);
  const [formColor, setFormColor] = useState<'good' | 'warn' | 'danger'>('good');

  const lastSpokenRef = useRef<{ issue: PushupIssue | null; at: number }>({ issue: null, at: 0 });
  const allRepsRef = useRef<RepResult[]>([]);

  const thresholds = useMemo(
    () => thresholdsFromCalibration(calibration ?? undefined),
    [calibration?.recordedAt, calibration?.minElbowAngle],
  );

  const analyzer = useMemo(
    () =>
      createPushupAnalyzer(
        {
          onRep: (result) => {
            allRepsRef.current.push(result);
            setLastRep(result);
            setReps(result.repNumber);
            setFormColor(
              result.formScore >= 80 ? 'good' : result.formScore >= 60 ? 'warn' : 'danger',
            );
          },
          onIssue: (issue) => {
            setLastIssue(issue);
            const now = Date.now();
            if (lastSpokenRef.current.issue === issue && now - lastSpokenRef.current.at < 2500) {
              return;
            }
            lastSpokenRef.current = { issue, at: now };
            Speech.speak(PUSHUP_ISSUE_VOICE[issue], { language: 'ko-KR', pitch: 1.0, rate: 1.0 });
          },
        },
        { thresholds },
      ),
    [thresholds],
  );

  const onPose = useCallback(
    (pose: PoseFrame) => {
      analyzer.feed(pose);
    },
    [analyzer],
  );

  const reset = useCallback(() => {
    analyzer.reset();
    allRepsRef.current = [];
    setReps(0);
    setLastRep(null);
    setLastIssue(null);
    setFormColor('good');
  }, [analyzer]);

  const getAllReps = useCallback(() => allRepsRef.current.slice(), []);

  const state: PushupSessionState = { reps, lastRep, lastIssue, formColor };
  return { state, onPose, reset, getAllReps };
}
