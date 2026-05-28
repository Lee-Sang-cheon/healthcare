import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { getCalibration, type SquatCalibration } from '@/features/calibration/calibrationApi';
import { getExercise } from '@/features/exercises/registry';
import { checkAlignment, type AlignmentCheck, type AlignmentChecks } from '@/features/pose/alignment';
import type { PoseFrame } from '@/features/pose/keypoints';
import { PoseCameraView } from '@/features/pose/PoseCameraView';
import { SkeletonOverlay } from '@/features/pose/SkeletonOverlay';
import { useTheme } from '@/hooks/use-theme';

/**
 * Sustained-ready window. We don't enable `시작` on a single good frame —
 * the user could be momentarily passing through a good pose. 1s of stable
 * 'ready' before we trust it.
 */
const READY_HOLD_MS = 1000;
const CHECK_THROTTLE_MS = 100;

const INITIAL_CHECKS: AlignmentChecks = {
  framing: { status: 'warn', message: '자세 인식 대기중...' },
  cameraAngle: { status: 'warn', message: '' },
  posture: { status: 'warn', message: '' },
  ready: false,
};

export default function SetupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ex = getExercise(id);
  const router = useRouter();
  const theme = useTheme();

  const [overlayPose, setOverlayPose] = useState<PoseFrame | null>(null);
  const [checks, setChecks] = useState<AlignmentChecks>(INITIAL_CHECKS);
  const [stableReady, setStableReady] = useState(false);
  const [calibration, setCalibration] = useState<SquatCalibration | null>(null);
  const readySinceRef = useRef<number | null>(null);
  const lastCheckTs = useRef(0);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => undefined);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
    };
  }, []);

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

  const handlePose = useCallback((pose: PoseFrame) => {
    const now = Date.now();
    if (now - lastCheckTs.current < CHECK_THROTTLE_MS) return;
    lastCheckTs.current = now;

    setOverlayPose(pose);
    const next = checkAlignment(pose);
    setChecks(next);

    if (next.ready) {
      if (readySinceRef.current == null) readySinceRef.current = now;
      if (now - readySinceRef.current >= READY_HOLD_MS) setStableReady(true);
    } else {
      readySinceRef.current = null;
      setStableReady(false);
    }
  }, []);

  if (!ex) {
    return (
      <View style={[styles.fallback, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: true, title: '오류' }} />
        <ThemedText type="body">알 수 없는 운동입니다.</ThemedText>
      </View>
    );
  }

  const goWorkout = () => {
    if (!stableReady) return;
    router.replace({ pathname: '/workout/[id]', params: { id: ex.id } });
  };

  const overlayColor = stableReady ? theme.formGood : theme.formWarn;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <PoseCameraView active={true} onPose={handlePose} />
      <SkeletonOverlay pose={overlayPose} color={overlayColor} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.chip, { backgroundColor: theme.background + 'CC' }]}
          >
            <ThemedText type="small" themeColor="textSecondary">← 뒤로</ThemedText>
          </Pressable>
          <View style={[styles.chip, { backgroundColor: theme.background + 'CC' }]}>
            <ThemedText type="caption" themeColor="textSecondary">
              {ex.name} 셋업
            </ThemedText>
          </View>
        </View>

        <View style={[styles.checkPanel, { backgroundColor: theme.background + 'D9', borderColor: theme.border }]}>
          <CheckRow check={checks.framing} label="프레이밍" />
          <CheckRow check={checks.cameraAngle} label="카메라 각도" />
          <CheckRow check={checks.posture} label="자세" />

          <View style={[styles.calibRow, { borderTopColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <ThemedText type="caption" themeColor="textSecondary">내 최대 깊이</ThemedText>
              <ThemedText type="bodyEmphasis">
                {calibration ? `${Math.round(calibration.maxKneeAngle)}°` : '미측정'}
              </ThemedText>
            </View>
            <Pressable
              onPress={() =>
                router.push({ pathname: '/calibrate/[id]', params: { id: ex.id } })
              }
              style={({ pressed }) => [
                styles.calibBtn,
                { borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <ThemedText type="small" themeColor="textSecondary">
                {calibration ? '재측정' : '측정하기'}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        <Pressable
          onPress={goWorkout}
          disabled={!stableReady}
          style={({ pressed }) => [
            styles.primary,
            {
              backgroundColor: stableReady ? theme.accent : theme.backgroundElement,
              opacity: pressed && stableReady ? 0.85 : 1,
            },
          ]}
        >
          <ThemedText
            type="heading"
            themeColor={stableReady ? 'background' : 'textMuted'}
          >
            {stableReady ? '시작' : '정렬 대기중...'}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

function CheckRow({ check, label }: { check: AlignmentCheck; label: string }) {
  const theme = useTheme();
  const color = check.status === 'ok' ? theme.formGood : theme.formWarn;
  return (
    <View style={styles.checkRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <ThemedText type="caption" themeColor="textSecondary">{label}</ThemedText>
        <ThemedText type="body">{check.message || '—'}</ThemedText>
      </View>
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
  checkPanel: {
    alignSelf: 'flex-end',
    width: '40%',
    minWidth: 280,
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  calibRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.three,
    marginTop: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  calibBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  primary: {
    alignSelf: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.six,
    borderRadius: Radius.lg,
    minWidth: 240,
    alignItems: 'center',
  },
});
