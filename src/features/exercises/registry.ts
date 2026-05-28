import { squatModule } from './squat';
import type { ExerciseMeta, ExerciseModule } from './types';

/**
 * Single source of truth for which exercises the app supports.
 * V1 MVP ships with squat only — disabled placeholders live as plain
 * {@link ExerciseMeta}s until their real modules ship.
 */

const placeholderMetas: ExerciseMeta[] = [
  {
    id: 'deadlift',
    name: '데드리프트',
    shortDescription: '척추 중립을 측면 카메라로 분석합니다.',
    primaryCameraAngle: 'side',
    enabled: false,
  },
  {
    id: 'pushup',
    name: '푸시업',
    shortDescription: '엉덩이 처짐과 팔꿈치 각도를 분석합니다.',
    primaryCameraAngle: 'side',
    enabled: false,
  },
];

const modules: ExerciseModule[] = [squatModule];

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
