export type PushupIssue =
  | 'shallow_depth'
  | 'hip_sag'
  | 'hip_pike'
  | 'tempo_too_fast';

export const PUSHUP_ISSUE_LABELS: Record<PushupIssue, string> = {
  shallow_depth: '얕은 깊이',
  hip_sag: '엉덩이 처짐',
  hip_pike: '엉덩이 들림',
  tempo_too_fast: '너무 빠름',
};

export const PUSHUP_ISSUE_VOICE: Record<PushupIssue, string> = {
  shallow_depth: '조금 더 깊게 내려가세요',
  hip_sag: '엉덩이가 처지고 있어요',
  hip_pike: '엉덩이가 너무 높습니다',
  tempo_too_fast: '천천히, 통제된 속도로',
};

export const PUSHUP_ISSUE_SEVERITY: Record<PushupIssue, number> = {
  hip_sag: 1,
  hip_pike: 2,
  shallow_depth: 3,
  tempo_too_fast: 4,
};
