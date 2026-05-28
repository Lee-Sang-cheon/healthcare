import type { SquatCalibration } from '@/features/calibration/calibrationApi';
import type { FormIssue } from '@/lib/supabase/types';

/**
 * Cross-exercise contracts. Each exercise (squat, deadlift, pushup...) ships
 * an {@link ExerciseModule} so screens can stay exercise-agnostic.
 *
 * The flow:
 *   exercises/registry.ts → ExerciseModule → useRuntime() → ExerciseRuntime
 *
 * Screens render whatever the runtime exposes (reps, lastIssue, ...) and
 * forward camera frames to `onPose`. The exercise module owns its own rules,
 * scoring, voice prompts, and per-rep accumulation.
 */

export type CameraAngle = 'side' | 'front';

export interface ExerciseMeta {
  id: string;
  name: string;
  shortDescription: string;
  primaryCameraAngle: CameraAngle;
  enabled: boolean;
}

export type FormColor = 'good' | 'warn' | 'danger';

/** Shape returned by useRuntime(). */
export interface ExerciseRuntime {
  state: {
    reps: number;
    lastIssue: FormIssue | null;
    formColor: FormColor;
  };
  /** Frame processor callback — forward every PoseFrame here. */
  onPose: (pose: import('@/features/pose/keypoints').PoseFrame) => void;
  /** All completed reps this session, for end-of-session persistence. */
  getAllReps: () => Array<{
    repNumber: number;
    formScore: number;
    issues: FormIssue[];
    durationMs: number;
  }>;
}

export interface ExerciseRuntimeOptions {
  /**
   * Personal calibration. Currently squat-shaped; widen this union as more
   * exercises grow calibration data.
   */
  calibration: SquatCalibration | null;
}

export interface ExerciseModule {
  meta: ExerciseMeta;
  /**
   * React hook returning the live analysis runtime. Must be stable in shape
   * — screens depend only on the {@link ExerciseRuntime} contract.
   */
  useRuntime: (options: ExerciseRuntimeOptions) => ExerciseRuntime;
  /** Human-readable per-issue labels, used by the live HUD. */
  issueLabels: Partial<Record<FormIssue, string>>;
}
