import { useCallback, useMemo, useRef, useState } from 'react';
import * as Speech from 'expo-speech';

import type { SquatCalibration } from '@/features/calibration/calibrationApi';
import type { PoseFrame } from '@/features/pose/keypoints';

import { SQUAT_ISSUE_VOICE, type SquatIssue } from './issues';
import { thresholdsFromCalibration } from './rules';
import type { RepResult } from './state-machine';
import { createSquatAnalyzer } from './state-machine';

export type SquatPhase = 'standing' | 'descending' | 'bottom' | 'ascending';

export interface SquatSessionState {
  reps: number;
  lastRep: RepResult | null;
  /** Latest issue spoken — for HUD subtle text. */
  lastIssue: SquatIssue | null;
  formColor: 'good' | 'warn' | 'danger';
}

export interface UseSquatSessionOptions {
  /** Optional personal calibration. If provided, `shallowDepthBelow` is computed from it. */
  calibration?: SquatCalibration | null;
}

/**
 * Top-level hook glueing the pose stream → analyzer → React state and TTS.
 * `onPose` is what gets passed to the camera frame processor.
 */
export function useSquatSession(options: UseSquatSessionOptions = {}) {
  const { calibration } = options;
  const [reps, setReps] = useState(0);
  const [lastRep, setLastRep] = useState<RepResult | null>(null);
  const [lastIssue, setLastIssue] = useState<SquatIssue | null>(null);
  const [formColor, setFormColor] = useState<'good' | 'warn' | 'danger'>('good');

  const lastSpokenRef = useRef<{ issue: SquatIssue | null; at: number }>({ issue: null, at: 0 });
  /** Every completed rep this mount has seen. Read via `getAllReps()` at end-of-session. */
  const allRepsRef = useRef<RepResult[]>([]);

  const thresholds = useMemo(
    () => thresholdsFromCalibration(calibration ?? undefined),
    // recordedAt changes on every save → cheap way to invalidate on any field change.
    [calibration?.recordedAt],
  );

  const analyzer = useMemo(
    () =>
      createSquatAnalyzer(
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
            // Voice with anti-spam: don't repeat the exact same issue within 2.5s.
            const now = Date.now();
            if (lastSpokenRef.current.issue === issue && now - lastSpokenRef.current.at < 2500)
              return;
            lastSpokenRef.current = { issue, at: now };
            Speech.speak(SQUAT_ISSUE_VOICE[issue], { language: 'ko-KR', pitch: 1.0, rate: 1.0 });
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

  const state: SquatSessionState = { reps, lastRep, lastIssue, formColor };
  return { state, onPose, reset, getAllReps };
}
