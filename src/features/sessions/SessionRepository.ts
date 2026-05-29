/**
 * Port for workout-session persistence. Swap implementations for offline
 * queues, test fakes, or alternative backends without touching screens or
 * domain logic.
 *
 * Issues are stored as plain `string[]` — the DB column is `text[]`, and
 * each exercise module owns its own issue union (see {@link ExerciseModule}).
 * This keeps the repository exercise-agnostic.
 *
 * Multi-set flow:
 *   start → {sessionId, setId, setNumber=1}
 *   (reps...) flushSet(setId, reps)
 *   startNextSet(sessionId, 1) → {setId, setNumber=2}
 *   (reps...) flushSet(setId, reps)
 *   closeSession(sessionId)  // aggregates over all sets
 */
export interface SessionRepository {
  start(exerciseId: string): Promise<StartSessionResult>;
  startNextSet(sessionId: string, currentSetNumber: number): Promise<StartSetResult>;
  /** Persist all reps for a set + roll up the set aggregates. Idempotent. */
  flushSet(setId: string, reps: RepInput[]): Promise<void>;
  /** Close the session — sets ended_at + aggregates from all sets in DB. */
  closeSession(sessionId: string): Promise<void>;
  getSummary(sessionId: string): Promise<SessionSummary>;
  /** Recent sessions for the signed-in user, newest first. */
  listRecent(limit?: number): Promise<SessionListItem[]>;
}

export interface SessionListItem {
  id: string;
  exercise_type: string;
  started_at: string;
  ended_at: string | null;
  total_reps: number;
  avg_form_score: number | null;
}

export interface StartSessionResult {
  sessionId: string;
  setId: string;
  setNumber: number;
}

export interface StartSetResult {
  setId: string;
  setNumber: number;
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
