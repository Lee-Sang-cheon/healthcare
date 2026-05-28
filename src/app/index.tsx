import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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

        <View style={styles.footnote}>
          <ThemedText type="small" themeColor="textMuted">
            영상 데이터는 기기 밖으로 전송되지 않습니다.
          </ThemedText>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    justifyContent: 'space-between',
  },
  header: { gap: Spacing.two },
  greeting: { marginTop: Spacing.one },
  primary: {
    paddingVertical: Spacing.four,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  footnote: { alignItems: 'center' },
});
