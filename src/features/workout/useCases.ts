import type { SquatCalibration } from '@/features/calibration/calibrationApi';
import { getCalibration } from '@/features/calibration/calibrationApi';
import { sessionRepository, type RepInput, type SessionRepository } from '@/features/sessions';

/**
 * Use cases compose repositories + domain helpers into single calls that
 * mean something at the business level ("start a workout", "finish a workout").
 *
 * Screens depend on these instead of orchestrating multiple effects.
 * Repository is injectable via the optional `repo` arg — tests pass an
 * in-memory fake; production uses the default Supabase binding.
 */

export interface WorkoutContext {
  sessionId: string;
  setId: string;
  /** May be null for first-time users who haven't calibrated yet. */
  calibration: SquatCalibration | null;
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
  const calibration =
    calRes.status === 'fulfilled' ? calRes.value.squat ?? null : null;

  return {
    sessionId: started.value.sessionId,
    setId: started.value.setId,
    calibration,
  };
}

/**
 * Close out a workout — persists reps + aggregates set/session totals.
 * Returning a `void` keeps the door open for future enrichments (analytics,
 * personal-best detection, push notifications) without churning callers.
 */
export async function finishWorkout(
  ctx: { sessionId: string; setId: string },
  reps: RepInput[],
  repo: SessionRepository = sessionRepository,
): Promise<void> {
  await repo.finish(ctx.sessionId, ctx.setId, reps);
}
