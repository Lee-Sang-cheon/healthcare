import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { getExercise } from '@/features/exercises/registry';
import { sessionRepository, type SessionSummary } from '@/features/sessions';
import { useTheme } from '@/hooks/use-theme';
import type { FormIssue } from '@/lib/supabase/types';

const ISSUE_LABEL: Record<FormIssue, string> = {
  knee_valgus: '무릎 안쪽 모임',
  forward_lean: '상체 숙임',
  shallow_depth: '얕은 깊이',
  asymmetry: '좌우 비대칭',
  knee_varus: '무릎 벌어짐',
  tempo_too_fast: '너무 빠름',
};

export default function ReportScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const theme = useTheme();

  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    sessionRepository.getSummary(sessionId)
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '리포트를 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <ThemedView style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: '리포트', headerBackTitle: '홈' }} />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          {error ? (
            <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <ThemedText type="heading">불러오기 실패</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">{error}</ThemedText>
            </View>
          ) : !summary ? (
            <View style={styles.loading}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : (
            <ReportBody summary={summary} />
          )}

          <Link href="/" asChild>
            <Pressable
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <ThemedText type="heading" themeColor="background">홈으로</ThemedText>
            </Pressable>
          </Link>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ReportBody({ summary }: { summary: SessionSummary }) {
  const theme = useTheme();
  const ex = getExercise(summary.session.exercise_type);
  const startedAt = new Date(summary.session.started_at);
  const endedAt = summary.session.ended_at ? new Date(summary.session.ended_at) : null;
  const durationMin =
    endedAt != null ? Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000)) : null;
  const issueSet = new Set<FormIssue>();
  for (const set of summary.sets) for (const i of set.issues_detected) issueSet.add(i);
  const issues = Array.from(issueSet);

  return (
    <>
      <ThemedText type="caption" themeColor="textSecondary">
        {ex?.name ?? summary.session.exercise_type} · {startedAt.toLocaleDateString('ko-KR')}
      </ThemedText>
      <ThemedText type="title">
        {summary.session.total_reps}회 완료
      </ThemedText>

      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <View style={styles.row}>
          <Stat label="평균 폼" value={summary.session.avg_form_score != null ? `${summary.session.avg_form_score}` : '—'} />
          <Stat label="총 렙" value={`${summary.session.total_reps}`} />
          <Stat label="시간" value={durationMin != null ? `${durationMin}분` : '—'} />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <ThemedText type="heading">감지된 이슈</ThemedText>
        {issues.length === 0 ? (
          <ThemedText type="body" themeColor="textSecondary">큰 이슈 없이 깔끔하게 마쳤습니다.</ThemedText>
        ) : (
          issues.map((i) => (
            <View key={i} style={styles.issueRow}>
              <View style={[styles.bullet, { backgroundColor: theme.formWarn }]} />
              <ThemedText type="body">{ISSUE_LABEL[i] ?? i}</ThemedText>
            </View>
          ))
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <ThemedText type="heading">렙별</ThemedText>
        {summary.reps.length === 0 ? (
          <ThemedText type="body" themeColor="textSecondary">기록된 렙이 없습니다.</ThemedText>
        ) : (
          summary.reps.map((r) => (
            <View key={r.id} style={styles.repRow}>
              <ThemedText type="bodyEmphasis">#{r.rep_number}</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                {r.form_score != null ? `${r.form_score}점` : '—'}
                {r.duration_ms != null ? ` · ${(r.duration_ms / 1000).toFixed(1)}s` : ''}
              </ThemedText>
            </View>
          ))
        )}
      </View>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="caption" themeColor="textSecondary">{label}</ThemedText>
      <ThemedText type="heading">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  loading: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
  },
  card: {
    padding: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  stat: { flex: 1, gap: Spacing.one },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  bullet: { width: 8, height: 8, borderRadius: 4 },
  repRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
  primary: {
    paddingVertical: Spacing.four,
    borderRadius: Radius.lg,
    alignItems: 'center',
    marginTop: Spacing.three,
  },
});
