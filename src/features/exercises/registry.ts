import { pushupModule } from './pushup';
import { squatModule } from './squat';
import type { ExerciseMeta, ExerciseModule } from './types';

/**
 * Single source of truth for which exercises the app supports.
 * Each enabled exercise lives as a full {@link ExerciseModule}; disabled
 * placeholders are plain {@link ExerciseMeta}s.
 */

const placeholderMetas: ExerciseMeta[] = [
  {
    id: 'deadlift',
    name: '데드리프트',
    shortDescription: '척추 중립을 측면 카메라로 분석합니다.',
    primaryCameraAngle: 'side',
    enabled: false,
  },
];

const modules: ExerciseModule[] = [squatModule, pushupModule];

/** Metadata for catalog screens (enabled + disabled, in display order). */
export const exercises: ExerciseMeta[] = [
  ...modules.map((m) => m.meta),
  ...placeholderMetas,
];

/** Look up a single exercise's metadata. */
export function getExercise(id: string | undefined | null): ExerciseMeta | undefined {
  if (!id) return undefined;
  return exercises.find((e) => e.id === id);
}

/**
 * Get the full {@link ExerciseModule} for an *enabled* exercise. Returns
 * undefined for disabled placeholders so callers must handle that case.
 */
export function getExerciseModule(id: string | undefined | null): ExerciseModule | undefined {
  if (!id) return undefined;
  return modules.find((m) => m.meta.id === id);
}

export type { CameraAngle, ExerciseMeta, ExerciseModule, ExerciseRuntime } from './types';
