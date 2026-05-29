import type { CalibrationData } from '@/features/calibration/calibrationApi';
import type { PoseFrame } from '@/features/pose/keypoints';

/**
 * Cross-exercise contracts. Each exercise (squat, deadlift, pushup...) ships
 * an {@link ExerciseModule} so screens can stay exercise-agnostic.
 *
 * Issue types are per-exercise — the module is generic over `TIssue extends
 * string`. The DB persists issues as `text[]` so any module can flush its
 * own union without schema changes.
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

/** Snapshot of a completed rep, exercise-agnostic shape. */
export interface CompletedRep<TIssue extends string = string> {
  repNumber: number;
  formScore: number;
  issues: TIssue[];
  durationMs: number;
}

/** Shape returned by useRuntime(). */
export interface ExerciseRuntime<TIssue extends string = string> {
  state: {
    reps: number;
    lastIssue: TIssue | null;
    formColor: FormColor;
  };
  /** Frame processor callback — forward every PoseFrame here. */
  onPose: (pose: PoseFrame) => void;
  /** All completed reps this set, for end-of-set persistence. */
  getAllReps: () => CompletedRep<TIssue>[];
  /** Clear the rep counter + accumulator. Used when starting a new set. */
  reset: () => void;
}

export interface ExerciseRuntimeOptions {
  /**
   * Full calibration payload. Each module pulls its own slice
   * (`calibration?.squat`, `calibration?.pushup`, ...) — keeps the runtime
   * factory exercise-agnostic.
   */
  calibration: CalibrationData | null;
}

export interface ExerciseModule<TIssue extends string = string> {
  meta: ExerciseMeta;
  /**
   * React hook returning the live analysis runtime. Must be stable in shape
   * — screens depend only on the {@link ExerciseRuntime} contract.
   */
  useRuntime: (options: ExerciseRuntimeOptions) => ExerciseRuntime<TIssue>;
  /** Human-readable per-issue labels, used by the live HUD + report. */
  issueLabels: Record<TIssue, string>;
  /** Spoken prompts via expo-speech, keyed by issue. */
  voicePrompts: Record<TIssue, string>;
}
