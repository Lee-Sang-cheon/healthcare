import { ensureAuth } from '@/features/auth/ensureAuth';
import { supabase } from '@/lib/supabase/client';

import type {
  RepInput,
  SessionListItem,
  SessionRepository,
  SessionSummary,
  StartSessionResult,
  StartSetResult,
} from './SessionRepository';

/**
 * Supabase-backed implementation. All RLS-protected; relies on `auth.uid()`
 * matching the inserted `user_id`. Anonymous sign-ins (via {@link ensureAuth})
 * are supported.
 */
export const supabaseSessionRepository: SessionRepository = {
  async start(exerciseId: string): Promise<StartSessionResult> {
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

    return { sessionId: session.id, setId: set.id, setNumber: 1 };
  },

  async startNextSet(sessionId: string, currentSetNumber: number): Promise<StartSetResult> {
    const nextNumber = currentSetNumber + 1;
    const { data: set, error } = await supabase
      .from('sets')
      .insert({ session_id: sessionId, set_number: nextNumber })
      .select('id')
      .single();
    if (error) throw error;
    return { setId: set.id, setNumber: nextNumber };
  },

  async flushSet(setId: string, reps: RepInput[]): Promise<void> {
    const totalReps = reps.length;
    const avgFormScore =
      totalReps > 0
        ? Number((reps.reduce((s, r) => s + r.formScore, 0) / totalReps).toFixed(2))
        : null;
    const issueSet = new Set<string>();
    for (const r of reps) for (const i of r.issues) issueSet.add(i);
    const issuesDetected = Array.from(issueSet);

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
  },

  async closeSession(sessionId: string): Promise<void> {
    // Aggregate over every set already flushed for this session.
    const { data: sets, error: setsErr } = await supabase
      .from('sets')
      .select('reps, avg_form_score')
      .eq('session_id', sessionId);
    if (setsErr) throw setsErr;

    let totalReps = 0;
    let weightedScoreSum = 0;
    let scoredReps = 0;
    for (const s of sets ?? []) {
      totalReps += s.reps ?? 0;
      if (s.avg_form_score != null && s.reps) {
        weightedScoreSum += s.avg_form_score * s.reps;
        scoredReps += s.reps;
      }
    }
    const avgFormScore = scoredReps > 0 ? Number((weightedScoreSum / scoredReps).toFixed(2)) : null;

    const { error } = await supabase
      .from('sessions')
      .update({
        ended_at: new Date().toISOString(),
        total_reps: totalReps,
        avg_form_score: avgFormScore,
      })
      .eq('id', sessionId);
    if (error) throw error;
  },

  async getSummary(sessionId: string): Promise<SessionSummary> {
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
  },

  async listRecent(limit = 20): Promise<SessionListItem[]> {
    // RLS confines this to the signed-in user's own sessions.
    const { data, error } = await supabase
      .from('sessions')
      .select('id, exercise_type, started_at, ended_at, total_reps, avg_form_score')
      .order('started_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },
};
