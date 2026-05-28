import type { FormIssue } from '@/lib/supabase/types';

/**
 * Port for workout-session persistence. Swap implementations for offline
 * queues, test fakes, or alternative backends without touching screens or
 * domain logic.
 */
export interface SessionRepository {
  start(exerciseId: string): Promise<StartSessionResult>;
  finish(sessionId: string, setId: string, reps: RepInput[]): Promise<void>;
  getSummary(sessionId: string): Promise<SessionSummary>;
}

export interface StartSessionResult {
  sessionId: string;
  setId: string;
}

export interface RepInput {
  repNumber: number;
  formScore: number;
  issues: FormIssue[];
  durationMs: number;
}

export interface SessionSummary {
  session: {
    id: string;
    exercise_type: string;
    started_at: string;
    ended_at: string | null;
    total_reps: number;
    avg_form_score: number | null;
  };
  sets: {
    id: string;
    set_number: number;
    reps: number;
    avg_form_score: number | null;
    issues_detected: FormIssue[];
  }[];
  reps: {
    id: string;
    set_id: string;
    rep_number: number;
    form_score: number | null;
    issues: FormIssue[];
    duration_ms: number | null;
  }[];
}
