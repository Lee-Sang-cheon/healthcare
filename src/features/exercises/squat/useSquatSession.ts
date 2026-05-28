import { useCallback, useMemo, useRef, useState } from 'react';
import * as Speech from 'expo-speech';

import type { PoseFrame } from '@/features/pose/keypoints';
import type { FormIssue } from '@/lib/supabase/types';

import type { RepResult } from './state-machine';
import { createSquatAnalyzer } from './state-machine';

const ISSUE_VOICE: Record<FormIssue, string> = {
  knee_valgus: '무릎이 안쪽으로 모이고 있어요',
  forward_lean: '상체가 너무 숙여졌습니다',
  shallow_depth: '조금 더 깊게 앉아보세요',
  asymmetry: '좌우 균형을 맞춰주세요',
  knee_varus: '무릎이 바깥으로 벌어졌어요',
  tempo_too_fast: '천천히, 통제된 속도로',
};

export type SquatPhase = 'standing' | 'descending' | 'bottom' | 'ascending';

export interface SquatSessionState {
  reps: number;
  lastRep: RepResult | null;
  /** Latest issue spoken — for HUD subtle text. */
  lastIssue: FormIssue | null;
  formColor: 'good' | 'warn' | 'danger';
}

/**
 * Top-level hook glueing the pose stream → analyzer → React state and TTS.
 * `onPose` is what gets passed to the camera frame processor.
 */
export function useSquatSession() {
  const [reps, setReps] = useState(0);
  const [lastRep, setLastRep] = useState<RepResult | null>(null);
  const [lastIssue, setLastIssue] = useState<FormIssue | null>(null);
  const [formColor, setFormColor] = useState<'good' | 'warn' | 'danger'>('good');

  const lastSpokenRef = useRef<{ issue: FormIssue | null; at: number }>({ issue: null, at: 0 });
  /** Every completed rep this mount has seen. Read via `getAllReps()` at end-of-session. */
  const allRepsRef = useRef<RepResult[]>([]);

  const analyzer = useMemo(
    () =>
      createSquatAnalyzer({
        onRep: (result) => {
          allRepsRef.current.push(result);
          setLastRep(result);
          setReps(result.repNumber);
          setFormColor(result.formScore >= 80 ? 'good' : result.formScore >= 60 ? 'warn' : 'danger');
        },
        onIssue: (issue) => {
          setLastIssue(issue);
          // Voice with anti-spam: don't repeat the exact same issue within 2.5s.
          const now = Date.now();
          if (lastSpokenRef.current.issue === issue && now - lastSpokenRef.current.at < 2500) return;
          lastSpokenRef.current = { issue, at: now };
          Speech.speak(ISSUE_VOICE[issue], { language: 'ko-KR', pitch: 1.0, rate: 1.0 });
        },
      }),
    [],
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
