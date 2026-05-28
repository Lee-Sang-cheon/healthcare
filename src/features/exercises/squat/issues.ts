/**
 * Squat-specific form issues. Each exercise module owns its own issue union
 * so unrelated issues don't leak across modules. DB persistence uses plain
 * `string[]` so any module can flush its issues without schema changes.
 */

export type SquatIssue =
  | 'shallow_depth'
  | 'knee_valgus'
  | 'knee_varus'
  | 'forward_lean'
  | 'asymmetry'
  | 'tempo_too_fast';

/** Short Korean labels used by the live HUD and report screen. */
export const SQUAT_ISSUE_LABELS: Record<SquatIssue, string> = {
  knee_valgus: '무릎 안쪽 모임',
  forward_lean: '상체 숙임',
  shallow_depth: '얕은 깊이',
  asymmetry: '좌우 비대칭',
  knee_varus: '무릎 벌어짐',
  tempo_too_fast: '너무 빠름',
};

/** Spoken prompts via expo-speech. Should sound calm and instructional. */
export const SQUAT_ISSUE_VOICE: Record<SquatIssue, string> = {
  knee_valgus: '무릎이 안쪽으로 모이고 있어요',
  forward_lean: '상체가 너무 숙여졌습니다',
  shallow_depth: '조금 더 깊게 앉아보세요',
  asymmetry: '좌우 균형을 맞춰주세요',
  knee_varus: '무릎이 바깥으로 벌어졌어요',
  tempo_too_fast: '천천히, 통제된 속도로',
};

/**
 * Voice priority — lower = more urgent / spoken first if multiple issues fire
 * in the same frame. Safety-critical issues (knee tracking) outrank cosmetic.
 */
export const SQUAT_ISSUE_SEVERITY: Record<SquatIssue, number> = {
  knee_valgus: 1,
  forward_lean: 2,
  shallow_depth: 3,
  asymmetry: 4,
  knee_varus: 5,
  tempo_too_fast: 6,
};
