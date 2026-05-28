import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { getExercise } from '@/features/exercises/registry';
import { useTheme } from '@/hooks/use-theme';

export default function SetupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ex = getExercise(id);
  const theme = useTheme();

  if (!ex) {
    return (
      <ThemedView style={styles.root}>
        <Stack.Screen options={{ headerShown: true, title: '오류' }} />
        <SafeAreaView style={styles.safe}>
          <ThemedText type="body">알 수 없는 운동입니다.</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: `${ex.name} 셋업` }} />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.body}>
          <ThemedText type="caption" themeColor="textSecondary">CAMERA SETUP</ThemedText>
          <ThemedText type="title">카메라를 {ex.primaryCameraAngle === 'side' ? '측면' : '정면'}에 두세요</ThemedText>
          <ThemedText type="body" themeColor="textSecondary" style={styles.lead}>
            폰을 약 1.5–2m 떨어뜨리고 전신이 화면에 들어오도록 합니다. 시작 버튼을 누르면 카메라가 자동으로 위치를 검증합니다.
          </ThemedText>

          <View style={[styles.checkList, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
            <View style={styles.checkRow}>
              <View style={[styles.bullet, { backgroundColor: theme.textMuted }]} />
              <ThemedText type="body">전신이 프레임 안에 들어오는지</ThemedText>
            </View>
            <View style={styles.checkRow}>
              <View style={[styles.bullet, { backgroundColor: theme.textMuted }]} />
              <ThemedText type="body">조명이 충분한지</ThemedText>
            </View>
            <View style={styles.checkRow}>
              <View style={[styles.bullet, { backgroundColor: theme.textMuted }]} />
              <ThemedText type="body">발끝부터 머리까지 흔들림 없는지</ThemedText>
            </View>
          </View>
        </View>

        <Link href={{ pathname: '/workout/[id]', params: { id: ex.id } }} asChild>
          <Pressable
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <ThemedText type="heading" themeColor="background">시작</ThemedText>
          </Pressable>
        </Link>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
    justifyContent: 'space-between',
  },
  body: { gap: Spacing.three },
  lead: { marginBottom: Spacing.three },
  checkList: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  bullet: { width: 8, height: 8, borderRadius: 4 },
  primary: {
    paddingVertical: Spacing.four,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
});
