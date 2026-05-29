import type { CalibrationData } from '@/features/calibration/calibrationApi';
import { getCalibration } from '@/features/calibration/calibrationApi';
import { sessionRepository, type RepInput, type SessionRepository } from '@/features/sessions';

/**
 * Use cases compose repositories + domain helpers into single calls that
 * mean something at the business level ("start a workout", "advance to the
 * next set", "finish a workout").
 *
 * Screens depend on these instead of orchestrating multiple effects.
 * Repository is injectable via the optional `repo` arg — tests pass an
 * in-memory fake; production uses the default Supabase binding.
 */

export interface WorkoutContext {
  sessionId: string;
  setId: string;
  setNumber: number;
  /** Full calibration payload; modules pick their own field. */
  calibration: CalibrationData | null;
}

/**
 * Open a new workout session and fetch the user's calibration in one shot.
 * Both calls go in parallel; if calibration fails we still return a usable
 * context (calibration: null) so the workout isn't blocked on a profile read.
 */
export async function startWorkout(
  exerciseId: string,
  repo: SessionRepository = sessionRepository,
): Promise<WorkoutContext> {
  const [started, calRes] = await Promise.allSettled([
    repo.start(exerciseId),
    getCalibration(),
  ]);

  if (started.status === 'rejected') throw started.reason;
  const calibration = calRes.status === 'fulfilled' ? calRes.value : null;

  return {
    sessionId: started.value.sessionId,
    setId: started.value.setId,
    setNumber: started.value.setNumber,
    calibration,
  };
}

/**
 * Flush the current set's reps and open the next set in the same session.
 * Returns the new context (same sessionId, new setId + setNumber).
 */
export async function advanceSet(
  ctx: WorkoutContext,
  reps: RepInput[],
  repo: SessionRepository = sessionRepository,
): Promise<WorkoutContext> {
  await repo.flushSet(ctx.setId, reps);
  const next = await repo.startNextSet(ctx.sessionId, ctx.setNumber);
  return { ...ctx, setId: next.setId, setNumber: next.setNumber };
}

/**
 * Close out a workout — flushes the final set + rolls up session aggregates.
 * Returning `void` keeps the door open for future enrichments (analytics,
 * personal-best detection) without churning callers.
 */
export async function finishWorkout(
  ctx: WorkoutContext,
  reps: RepInput[],
  repo: SessionRepository = sessionRepository,
): Promise<void> {
  await repo.flushSet(ctx.setId, reps);
  await repo.closeSession(ctx.sessionId);
}
