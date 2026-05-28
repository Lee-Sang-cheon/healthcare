# Supabase

이 폴더는 Form Coach 백엔드 (Supabase) 의 마이그레이션을 보관합니다.

## 초기 마이그레이션 적용 방법

가장 빠른 길:

1. Supabase Studio → 프로젝트 선택 → SQL Editor
2. `migrations/0001_init.sql` 내용을 복사해 붙여넣고 Run

또는 Supabase CLI 사용 시:

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

## 스키마 요약

| 테이블 | 역할 |
| --- | --- |
| `profiles` | `auth.users` 확장 (키, 체중, 캘리브레이션 JSON). 회원가입 시 자동 생성 |
| `sessions` | 한 번의 운동 세션 |
| `sets` | 세션 안의 각 세트 |
| `reps` | 개별 렙. `keypoint_snapshot`은 문제 렙만 짧게 저장 (정책 일관성) |
| `session_muscle_load` | 추정 근육 활성도 (운동학적 추정치임을 UI에 명시) |

모든 테이블에 RLS 활성화. 각 사용자는 자신의 데이터만 읽고 씁니다.
