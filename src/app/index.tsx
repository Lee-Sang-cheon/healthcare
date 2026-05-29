import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { getExercise } from '@/features/exercises/registry';
import { sessionRepository, type SessionListItem } from '@/features/sessions';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const theme = useTheme();
  const [recent, setRecent] = useState<SessionListItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    sessionRepository
      .listRecent(5)
      .then((items) => {
        if (!cancelled) setRecent(items);
      })
      .catch((err) => {
        console.warn('listRecent failed', err);
        if (!cancelled) setRecent([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <ThemedText type="caption" themeColor="textSecondary">FORM COACH</ThemedText>
            <ThemedText type="title" style={styles.greeting}>오늘의 운동</ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              카메라가 자세를 분석하고 부상 위험을 알려드립니다.
            </ThemedText>
          </View>

          <Link href="/exercises" asChild>
            <Pressable
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <ThemedText type="heading" themeColor="background">운동 시작</ThemedText>
            </Pressable>
          </Link>

          {recent && recent.length > 0 && (
            <View style={styles.recentSection}>
              <ThemedText type="caption" themeColor="textSecondary">최근 세션</ThemedText>
              {recent.map((s) => (
                <RecentSessionRow key={s.id} session={s} />
              ))}
            </View>
          )}

          <View style={styles.footnote}>
            <ThemedText type="small" themeColor="textMuted">
              영상 데이터는 기기 밖으로 전송되지 않습니다.
            </ThemedText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function RecentSessionRow({ session }: { session: SessionListItem }) {
  const theme = useTheme();
  const ex = getExercise(session.exercise_type);
  const startedAt = new Date(session.started_at);
  const dateLabel = startedAt.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Link href={{ pathname: '/report/[sessionId]', params: { sessionId: session.id } }} asChild>
      <Pressable
        style={({ pressed }) => [
          styles.recentRow,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={styles.recentRowLeft}>
          <ThemedText type="bodyEmphasis">{ex?.name ?? session.exercise_type}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{dateLabel}</ThemedText>
        </View>
        <View style={styles.recentRowRight}>
          <ThemedText type="body">{session.total_reps}회</ThemedText>
          {session.avg_form_score != null && (
            <ThemedText type="small" themeColor="textSecondary">
              평균 {Math.round(session.avg_form_score)}점
            </ThemedText>
          )}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  header: { gap: Spacing.two },
  greeting: { marginTop: Spacing.one },
  primary: {
    paddingVertical: Spacing.four,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  recentSection: { gap: Spacing.two },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  recentRowLeft: { gap: 2 },
  recentRowRight: { alignItems: 'flex-end', gap: 2 },
  footnote: { alignItems: 'center', marginTop: Spacing.three },
});
