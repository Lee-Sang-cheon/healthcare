import { useKeepAwake } from 'expo-keep-awake';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorBanner } from '@/components/error-banner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { getExerciseModule } from '@/features/exercises/registry';
import type { ExerciseModule } from '@/features/exercises/types';
import type { PoseFrame } from '@/features/pose/keypoints';
import { PoseCameraView } from '@/features/pose/PoseCameraView';
import { SkeletonOverlay } from '@/features/pose/SkeletonOverlay';
import { advanceSet, finishWorkout, startWorkout, type WorkoutContext } from '@/features/workout/useCases';
import { useTheme } from '@/hooks/use-theme';

/** Overlay re-render cadence (ms). Analyzer still runs at full camera fps. */
const OVERLAY_THROTTLE_MS = 66;

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mod = getExerciseModule(id);
  const theme = useTheme();

  if (!mod) {
    return (
      <View style={[styles.fallback, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: true, title: '오류' }} />
        <ThemedText type="body">알 수 없는 운동입니다.</ThemedText>
      </View>
    );
  }

  // `mod` doesn't change while this screen is mounted (driven by route param),
  // so calling hooks inside ActiveWorkout below is safe.
  return <ActiveWorkout mod={mod} />;
}

function ActiveWorkout({ mod }: { mod: ExerciseModule }) {
  const router = useRouter();
  const theme = useTheme();
  const [ctx, setCtx] = useState<WorkoutContext | null>(null);
  const { state, onPose, getAllReps, reset } = mod.useRuntime({
    calibration: ctx?.calibration ?? null,
  });
  const [overlayPose, setOverlayPose] = useState<PoseFrame | null>(null);
  const [saving, setSaving] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const lastOverlayTs = useRef(0);

  useKeepAwake('workout');

  useEffect(() => {
    // Squat is best filmed landscape from the side.
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => undefined);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    startWorkout(mod.meta.id)
      .then((next) => {
        if (!cancelled) setCtx(next);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('startWorkout failed; workout will run without saving.', err);
        setErrorMsg(
          '세션 시작 실패 — 운동은 계속할 수 있지만 결과가 저장되지 않습니다.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [mod.meta.id]);

  const handlePose = useCallback(
    (pose: PoseFrame) => {
      onPose(pose);
      const now = Date.now();
      if (now - lastOverlayTs.current >= OVERLAY_THROTTLE_MS) {
        lastOverlayTs.current = now;
        setOverlayPose(pose);
      }
    },
    [onPose],
  );

  const collectReps = useCallback(
    () =>
      getAllReps().map((r) => ({
        repNumber: r.repNumber,
        formScore: r.formScore,
        issues: r.issues,
        durationMs: r.durationMs,
      })),
    [getAllReps],
  );

  const handleNextSet = useCallback(async () => {
    if (advancing || saving || !ctx) return;
    setAdvancing(true);
    try {
      const next = await advanceSet(ctx, collectReps());
      setCtx(next);
      reset();
    } catch (err) {
      console.warn('advanceSet failed', err);
      setErrorMsg('다음 세트 시작 실패 — 다시 시도하세요.');
    } finally {
      setAdvancing(false);
    }
  }, [advancing, collectReps, ctx, reset, saving]);

  const handleEnd = useCallback(async () => {
    if (saving) return;
    if (!ctx) {
      router.replace('/');
      return;
    }
    setSaving(true);
    try {
      await finishWorkout(ctx, collectReps());
      router.replace({ pathname: '/report/[sessionId]', params: { sessionId: ctx.sessionId } });
    } catch (err) {
      console.warn('finishWorkout failed', err);
      setSaving(false);
      setErrorMsg('저장 실패 — 다시 시도하거나 종료를 한번 더 누르면 홈으로 돌아갑니다.');
    }
  }, [collectReps, ctx, router, saving]);

  const bandColor =
    state.formColor === 'good'
      ? theme.formGood
      : state.formColor === 'warn'
      ? theme.formWarn
      : theme.formDanger;

  const issueLabel = state.lastIssue ? mod.issueLabels[state.lastIssue] : null;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <PoseCameraView active={true} onPose={handlePose} />
      <SkeletonOverlay pose={overlayPose} color={bandColor} />
      <ErrorBanner message={errorMsg} onDismiss={() => setErrorMsg(null)} />

      {/* Form-status border band — sits on top of camera feed */}
      <View style={[styles.statusBand, { borderColor: bandColor }]} pointerEvents="none" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <ThemedView style={[styles.chip, { backgroundColor: theme.background + 'CC' }]}>
            <ThemedText type="caption" themeColor="textSecondary">
              {mod.meta.name} · {ctx?.setNumber ?? 1}세트
            </ThemedText>
          </ThemedView>
          <View style={styles.actions}>
            <Pressable
              onPress={handleNextSet}
              disabled={advancing || saving || !ctx || state.reps === 0}
              style={[
                styles.chip,
                {
                  backgroundColor: theme.background + 'CC',
                  opacity: advancing || saving || !ctx || state.reps === 0 ? 0.5 : 1,
                },
              ]}
            >
              {advancing ? (
                <ActivityIndicator color={theme.textSecondary} size="small" />
              ) : (
                <ThemedText type="small" themeColor="textSecondary">다음 세트</ThemedText>
              )}
            </Pressable>
            <Pressable
              onPress={handleEnd}
              disabled={saving || advancing}
              style={[styles.chip, { backgroundColor: theme.background + 'CC', opacity: saving ? 0.6 : 1 }]}
            >
              {saving ? (
                <ActivityIndicator color={theme.textSecondary} size="small" />
              ) : (
                <ThemedText type="small" themeColor="textSecondary">종료</ThemedText>
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.center}>
          <ThemedText type="caption" themeColor="textSecondary">REPS</ThemedText>
          <ThemedText type="display">{state.reps}</ThemedText>
          {issueLabel && (
            <ThemedText type="bodyEmphasis" themeColor="formWarn">
              {issueLabel}
            </ThemedText>
          )}
        </View>

        <View style={{ height: Spacing.three }} />
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
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    justifyContent: 'space-between',
  },
  statusBand: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    right: Spacing.two,
    bottom: Spacing.two,
    borderWidth: 6,
    borderRadius: Radius.lg,
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
  actions: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', flex: 1, gap: Spacing.two },
});
