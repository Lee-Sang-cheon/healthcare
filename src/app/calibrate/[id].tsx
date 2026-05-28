import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { saveSquatCalibration } from '@/features/calibration/calibrationApi';
import { getExercise } from '@/features/exercises/registry';
import { analyzeSquatFrame } from '@/features/exercises/squat/rules';
import type { PoseFrame } from '@/features/pose/keypoints';
import { PoseCameraView } from '@/features/pose/PoseCameraView';
import { SkeletonOverlay } from '@/features/pose/SkeletonOverlay';
import { useTheme } from '@/hooks/use-theme';

type Phase = 'instructions' | 'countdown' | 'measuring' | 'review' | 'saving' | 'saved';

const COUNTDOWN_SEC = 3;
const MEASURE_SEC = 10;

/**
 * One-time personal ROM capture. The user does their deepest squat in a fixed
 * window; we track the smallest knee interior angle seen (lower = deeper) and
 * persist it to `profiles.calibration.squat.maxKneeAngle`.
 *
 * Subsequent squat sessions can use this as a personal "shallow" threshold
 * rather than the default 110°.
 */
export default function CalibrateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ex = getExercise(id);
  const router = useRouter();
  const theme = useTheme();

  const [phase, setPhase] = useState<Phase>('instructions');
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SEC);
  const [minKnee, setMinKnee] = useState<number | null>(null);
  const [overlayPose, setOverlayPose] = useState<PoseFrame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const minKneeRef = useRef<number | null>(null);
  const lastFrameTs = useRef(0);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => undefined);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
    };
  }, []);

  // Drives countdown → measuring → review timing.
  useEffect(() => {
    if (phase !== 'countdown' && phase !== 'measuring') return;
    const total = phase === 'countdown' ? COUNTDOWN_SEC : MEASURE_SEC;
    setSecondsLeft(total);
    const startTs = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTs) / 1000;
      const remaining = Math.max(0, Math.ceil(total - elapsed));
      setSecondsLeft(remaining);
      if (elapsed >= total) {
        clearInterval(interval);
        if (phase === 'countdown') {
          setPhase('measuring');
        } else {
          setPhase('review');
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [phase]);

  const handlePose = useCallback(
    (pose: PoseFrame) => {
      const now = Date.now();
      if (now - lastFrameTs.current < 80) return;
      lastFrameTs.current = now;
      setOverlayPose(pose);

      if (phase !== 'measuring') return;
      const metrics = analyzeSquatFrame(pose);
      if (!metrics.reliable) return;
      if (minKneeRef.current == null || metrics.kneeAngle < minKneeRef.current) {
        minKneeRef.current = metrics.kneeAngle;
        setMinKnee(metrics.kneeAngle);
      }
    },
    [phase],
  );

  const startCountdown = () => {
    minKneeRef.current = null;
    setMinKnee(null);
    setError(null);
    setPhase('countdown');
  };

  const retry = () => {
    startCountdown();
  };

  const save = async () => {
    if (minKnee == null) return;
    setPhase('saving');
    try {
      await saveSquatCalibration(Number(minKnee.toFixed(2)));
      setPhase('saved');
      // Small delay so the user sees the confirmation, then back to setup.
      setTimeout(() => router.replace({ pathname: '/setup/[id]', params: { id: ex?.id ?? 'squat' } }), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
      setPhase('review');
    }
  };

  if (!ex) {
    return (
      <View style={[styles.fallback, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: true, title: '오류' }} />
        <ThemedText type="body">알 수 없는 운동입니다.</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <PoseCameraView active={true} onPose={handlePose} />
      <SkeletonOverlay
        pose={overlayPose}
        color={phase === 'measuring' ? theme.formGood : '#FFFFFF'}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.chip, { backgroundColor: theme.background + 'CC' }]}
          >
            <ThemedText type="small" themeColor="textSecondary">← 뒤로</ThemedText>
          </Pressable>
          <View style={[styles.chip, { backgroundColor: theme.background + 'CC' }]}>
            <ThemedText type="caption" themeColor="textSecondary">깊이 측정</ThemedText>
          </View>
        </View>

        <View style={[styles.panel, { backgroundColor: theme.background + 'D9', borderColor: theme.border }]}>
          {phase === 'instructions' && (
            <>
              <ThemedText type="heading">최대 깊이를 측정합니다</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                준비가 되면 시작 버튼을 누르세요. 3초 카운트다운 후 {MEASURE_SEC}초 동안 최대한 깊이
                한 번 앉아주세요. 가장 깊은 무릎 각도가 자동으로 기록됩니다.
              </ThemedText>
              <Pressable
                onPress={startCountdown}
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <ThemedText type="heading" themeColor="background">시작</ThemedText>
              </Pressable>
            </>
          )}

          {phase === 'countdown' && (
            <>
              <ThemedText type="caption" themeColor="textSecondary">준비</ThemedText>
              <ThemedText type="display">{secondsLeft}</ThemedText>
            </>
          )}

          {phase === 'measuring' && (
            <>
              <ThemedText type="caption" themeColor="formGood">측정중 · {secondsLeft}s</ThemedText>
              <ThemedText type="body">최대한 깊이 앉아보세요</ThemedText>
              <ThemedText type="title">
                {minKnee != null ? `${Math.round(minKnee)}°` : '--°'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">현재 최저 무릎 각도</ThemedText>
            </>
          )}

          {phase === 'review' && (
            <>
              <ThemedText type="caption" themeColor="textSecondary">결과</ThemedText>
              <ThemedText type="title">
                {minKnee != null ? `${Math.round(minKnee)}°` : '측정 실패'}
              </ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                {minKnee != null
                  ? '이 각도가 당신의 최대 깊이로 저장됩니다.'
                  : '자세가 인식되지 않았습니다. 다시 시도하세요.'}
              </ThemedText>
              {error && (
                <ThemedText type="small" themeColor="formDanger">{error}</ThemedText>
              )}
              <View style={styles.row}>
                <Pressable
                  onPress={retry}
                  style={({ pressed }) => [
                    styles.secondary,
                    { borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <ThemedText type="bodyEmphasis">다시</ThemedText>
                </Pressable>
                <Pressable
                  onPress={save}
                  disabled={minKnee == null}
                  style={({ pressed }) => [
                    styles.primary,
                    {
                      backgroundColor: minKnee != null ? theme.accent : theme.backgroundElement,
                      opacity: pressed && minKnee != null ? 0.85 : 1,
                    },
                  ]}
                >
                  <ThemedText
                    type="heading"
                    themeColor={minKnee != null ? 'background' : 'textMuted'}
                  >
                    저장
                  </ThemedText>
                </Pressable>
              </View>
            </>
          )}

          {phase === 'saving' && (
            <View style={styles.saving}>
              <ActivityIndicator color={theme.accent} />
              <ThemedText type="body" themeColor="textSecondary">저장중...</ThemedText>
            </View>
          )}

          {phase === 'saved' && (
            <ThemedText type="heading" themeColor="formGood">저장됨 ✓</ThemedText>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  safe: {
    flex: 1,
    padding: Spacing.four,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
  panel: {
    alignSelf: 'flex-end',
    width: '45%',
    minWidth: 320,
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.two },
  primary: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  secondary: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  saving: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
  },
});
