/**
 * Port for workout-session persistence. Swap implementations for offline
 * queues, test fakes, or alternative backends without touching screens or
 * domain logic.
 *
 * Issues are stored as plain `string[]` — the DB column is `text[]`, and
 * each exercise module owns its own issue union (see {@link ExerciseModule}).
 * This keeps the repository exercise-agnostic.
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
  issues: string[];
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
    issues_detected: string[];
  }[];
  reps: {
    id: string;
    set_id: string;
    rep_number: number;
    form_score: number | null;
    issues: string[];
    duration_ms: number | null;
  }[];
}
