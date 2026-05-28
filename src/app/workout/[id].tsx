import { useKeepAwake } from 'expo-keep-awake';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { getCalibration, type SquatCalibration } from '@/features/calibration/calibrationApi';
import { getExercise } from '@/features/exercises/registry';
import { useSquatSession } from '@/features/exercises/squat/useSquatSession';
import type { PoseFrame } from '@/features/pose/keypoints';
import { PoseCameraView } from '@/features/pose/PoseCameraView';
import { SkeletonOverlay } from '@/features/pose/SkeletonOverlay';
import { finishSession, startSession } from '@/features/sessions/sessionApi';
import { useTheme } from '@/hooks/use-theme';

/** Overlay re-render cadence (ms). Analyzer still runs at full camera fps. */
const OVERLAY_THROTTLE_MS = 66;

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ex = getExercise(id);
  const router = useRouter();
  const theme = useTheme();
  const [calibration, setCalibration] = useState<SquatCalibration | null>(null);
  const { state, onPose, getAllReps } = useSquatSession({ calibration });
  const [overlayPose, setOverlayPose] = useState<PoseFrame | null>(null);
  const [persistIds, setPersistIds] = useState<{ sessionId: string; setId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const lastOverlayTs = useRef(0);

  useEffect(() => {
    let cancelled = false;
    getCalibration()
      .then((c) => {
        if (!cancelled && c.squat) setCalibration(c.squat);
      })
      .catch((err) => console.warn('getCalibration failed', err));
    return () => {
      cancelled = true;
    };
  }, []);

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

  useKeepAwake('workout');

  useEffect(() => {
    // Squat is best filmed landscape from the side.
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => undefined);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (!ex) return;
    let cancelled = false;
    startSession(ex.id)
      .then((ids) => {
        if (!cancelled) setPersistIds(ids);
      })
      .catch((err) => {
        console.warn('startSession failed; workout will run without saving.', err);
      });
    return () => {
      cancelled = true;
    };
  }, [ex]);

  const handleEnd = useCallback(async () => {
    if (saving) return;
    if (!persistIds) {
      router.replace('/');
      return;
    }
    setSaving(true);
    const reps = getAllReps().map((r) => ({
      repNumber: r.repNumber,
      formScore: r.formScore,
      issues: r.issues,
      durationMs: r.durationMs,
    }));
    try {
      await finishSession(persistIds.sessionId, persistIds.setId, reps);
      router.replace({ pathname: '/report/[sessionId]', params: { sessionId: persistIds.sessionId } });
    } catch (err) {
      console.warn('finishSession failed', err);
      router.replace('/');
    }
  }, [getAllReps, persistIds, router, saving]);

  const bandColor =
    state.formColor === 'good'
      ? theme.formGood
      : state.formColor === 'warn'
      ? theme.formWarn
      : theme.formDanger;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <PoseCameraView active={true} onPose={handlePose} />

      <SkeletonOverlay pose={overlayPose} color={bandColor} />

      {/* Form-status border band — sits on top of camera feed */}
      <View style={[styles.statusBand, { borderColor: bandColor }]} pointerEvents="none" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <ThemedView style={[styles.chip, { backgroundColor: theme.background + 'CC' }]}>
            <ThemedText type="caption" themeColor="textSecondary">
              {ex?.name ?? '운동'} · 1세트
            </ThemedText>
          </ThemedView>
          <Pressable
            onPress={handleEnd}
            disabled={saving}
            style={[styles.chip, { backgroundColor: theme.background + 'CC', opacity: saving ? 0.6 : 1 }]}
          >
            {saving ? (
              <ActivityIndicator color={theme.textSecondary} size="small" />
            ) : (
              <ThemedText type="small" themeColor="textSecondary">종료</ThemedText>
            )}
          </Pressable>
        </View>

        <View style={styles.center}>
          <ThemedText type="caption" themeColor="textSecondary">REPS</ThemedText>
          <ThemedText type="display">{state.reps}</ThemedText>
          {state.lastIssue && (
            <ThemedText type="bodyEmphasis" themeColor="formWarn">
              {ISSUE_LABEL[state.lastIssue]}
            </ThemedText>
          )}
        </View>

        <View style={{ height: Spacing.three }} />
      </SafeAreaView>
    </View>
  );
}

const ISSUE_LABEL: Record<string, string> = {
  knee_valgus: '무릎 안쪽 모임',
  forward_lean: '상체 숙임',
  shallow_depth: '얕은 깊이',
  asymmetry: '좌우 비대칭',
  knee_varus: '무릎 벌어짐',
  tempo_too_fast: '너무 빠름',
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
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
  center: { alignItems: 'center', justifyContent: 'center', flex: 1, gap: Spacing.two },
});
