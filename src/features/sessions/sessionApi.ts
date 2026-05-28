import { ensureAuth } from '@/features/auth/ensureAuth';
import { supabase } from '@/lib/supabase/client';
import type { FormIssue } from '@/lib/supabase/types';

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

/**
 * Creates a `sessions` row + the initial `sets` row (set_number = 1) and
 * returns both ids. Will trigger an anonymous sign-in if no auth session
 * exists yet.
 */
export async function startSession(exerciseId: string): Promise<StartSessionResult> {
  const userId = await ensureAuth();

  const { data: session, error: sessionErr } = await supabase
    .from('sessions')
    .insert({ user_id: userId, exercise_type: exerciseId })
    .select('id')
    .single();
  if (sessionErr) throw sessionErr;

  const { data: set, error: setErr } = await supabase
    .from('sets')
    .insert({ session_id: session.id, set_number: 1 })
    .select('id')
    .single();
  if (setErr) throw setErr;

  return { sessionId: session.id, setId: set.id };
}

/**
 * Flushes all reps for the active set, then closes the session.
 * - Bulk-inserts every rep (one round trip)
 * - Updates the set aggregates (reps count, avg score, union of issues)
 * - Updates the session aggregates (ended_at, total_reps, avg_form_score)
 *
 * If `reps` is empty, the inserts/updates still run so the session ends
 * cleanly with `total_reps = 0`.
 */
export async function finishSession(
  sessionId: string,
  setId: string,
  reps: RepInput[],
): Promise<void> {
  const totalReps = reps.length;
  const avgFormScore =
    totalReps > 0
      ? Number((reps.reduce((s, r) => s + r.formScore, 0) / totalReps).toFixed(2))
      : null;
  const issueSet = new Set<FormIssue>();
  for (const r of reps) for (const i of r.issues) issueSet.add(i);
  const issuesDetected = Array.from(issueSet);
  const endedAt = new Date().toISOString();

  if (totalReps > 0) {
    const repRows = reps.map((r) => ({
      set_id: setId,
      rep_number: r.repNumber,
      form_score: r.formScore,
      issues: r.issues,
      duration_ms: r.durationMs,
    }));
    const { error } = await supabase.from('reps').insert(repRows);
    if (error) throw error;
  }

  const { error: setUpdErr } = await supabase
    .from('sets')
    .update({
      reps: totalReps,
      avg_form_score: avgFormScore,
      issues_detected: issuesDetected,
    })
    .eq('id', setId);
  if (setUpdErr) throw setUpdErr;

  const { error: sessUpdErr } = await supabase
    .from('sessions')
    .update({
      ended_at: endedAt,
      total_reps: totalReps,
      avg_form_score: avgFormScore,
    })
    .eq('id', sessionId);
  if (sessUpdErr) throw sessUpdErr;
}

/** Loads everything the report screen needs in three round trips. */
export async function getSessionSummary(sessionId: string): Promise<SessionSummary> {
  const { data: session, error: sessErr } = await supabase
    .from('sessions')
    .select('id, exercise_type, started_at, ended_at, total_reps, avg_form_score')
    .eq('id', sessionId)
    .single();
  if (sessErr) throw sessErr;

  const { data: sets, error: setsErr } = await supabase
    .from('sets')
    .select('id, set_number, reps, avg_form_score, issues_detected')
    .eq('session_id', sessionId)
    .order('set_number', { ascending: true });
  if (setsErr) throw setsErr;

  const setIds = (sets ?? []).map((s) => s.id);
  let reps: SessionSummary['reps'] = [];
  if (setIds.length > 0) {
    const { data: repRows, error: repsErr } = await supabase
      .from('reps')
      .select('id, set_id, rep_number, form_score, issues, duration_ms')
      .in('set_id', setIds)
      .order('rep_number', { ascending: true });
    if (repsErr) throw repsErr;
    reps = repRows ?? [];
  }

  return { session, sets: sets ?? [], reps };
}
