import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RepScoreChart } from '@/components/rep-score-chart';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { getExercise, getExerciseModule } from '@/features/exercises/registry';
import { sessionRepository, type SessionSummary } from '@/features/sessions';
import { useTheme } from '@/hooks/use-theme';

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
  const mod = getExerciseModule(summary.session.exercise_type);
  const startedAt = new Date(summary.session.started_at);
  const endedAt = summary.session.ended_at ? new Date(summary.session.ended_at) : null;
  const durationMin =
    endedAt != null ? Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000)) : null;
  const issueSet = new Set<string>();
  for (const set of summary.sets) for (const i of set.issues_detected) issueSet.add(i);
  const issues = Array.from(issueSet);

  // Linearize reps across all sets in set/rep order for the chart.
  const setOrder = new Map(summary.sets.map((s, i) => [s.id, i]));
  const repsOrdered = [...summary.reps].sort((a, b) => {
    const sa = setOrder.get(a.set_id) ?? 0;
    const sb = setOrder.get(b.set_id) ?? 0;
    if (sa !== sb) return sa - sb;
    return a.rep_number - b.rep_number;
  });
  const repScores = repsOrdered.map((r) => r.form_score);
  // Mark set boundaries (the rep index at which a new set begins).
  const setBoundaries: number[] = [];
  let acc = 0;
  for (const s of summary.sets) {
    if (acc > 0) setBoundaries.push(acc);
    acc += s.reps ?? 0;
  }

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
              <ThemedText type="body">
                {(mod?.issueLabels as Record<string, string> | undefined)?.[i] ?? i}
              </ThemedText>
            </View>
          ))
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <ThemedText type="heading">렙별 폼</ThemedText>
        {summary.reps.length === 0 ? (
          <ThemedText type="body" themeColor="textSecondary">기록된 렙이 없습니다.</ThemedText>
        ) : (
          <>
            <RepScoreChart scores={repScores} setBoundaries={setBoundaries} />
            <View style={{ height: Spacing.two }} />
            {summary.sets.length > 1 && (
              <View style={styles.setSummaries}>
                {summary.sets.map((s) => (
                  <View key={s.id} style={styles.setSummary}>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {s.set_number}세트
                    </ThemedText>
                    <ThemedText type="bodyEmphasis">
                      {s.reps}회{s.avg_form_score != null ? ` · ${Math.round(s.avg_form_score)}점` : ''}
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}
          </>
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
  setSummaries: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  setSummary: {
    gap: 2,
  },
  primary: {
    paddingVertical: Spacing.four,
    borderRadius: Radius.lg,
    alignItems: 'center',
    marginTop: Spacing.three,
  },
});
