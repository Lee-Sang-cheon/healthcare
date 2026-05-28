import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { saveSquatCalibration } from '@/features/calibration/calibrationApi';
import {
  buildStandingBaseline,
  extractStandingSample,
  type StandingBaseline,
  type StandingSample,
} from '@/features/exercises/squat/baseline';
import { analyzeSquatFrame } from '@/features/exercises/squat/rules';
import { getExercise } from '@/features/exercises/registry';
import type { PoseFrame } from '@/features/pose/keypoints';
import { PoseCameraView } from '@/features/pose/PoseCameraView';
import { SkeletonOverlay } from '@/features/pose/SkeletonOverlay';
import { useTheme } from '@/hooks/use-theme';

type Phase =
  | 'instructions'
  | 'standing-prep'
  | 'standing-capture'
  | 'squat-prep'
  | 'squat-capture'
  | 'review'
  | 'saving'
  | 'saved';

const STANDING_PREP_SEC = 3;
const STANDING_CAPTURE_SEC = 3;
const SQUAT_PREP_SEC = 3;
const SQUAT_CAPTURE_SEC = 10;
const MIN_STANDING_SAMPLES = 8;

/**
 * Two-phase personal baseline capture:
 *
 *  A.  Stand relaxed → average trunk tilt, asymmetry, knee cave, knee
 *      extension, and femur/torso ratio over a few seconds.
 *  B.  Deepest squat → track smallest knee angle over a longer window.
 *
 * Both blocks are saved together so subsequent workouts can score by
 * deviation from this user's baseline rather than population averages.
 */
export default function CalibrateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ex = getExercise(id);
  const router = useRouter();
  const theme = useTheme();

  const [phase, setPhase] = useState<Phase>('instructions');
  const [secondsLeft, setSecondsLeft] = useState(STANDING_PREP_SEC);
  const [baseline, setBaseline] = useState<StandingBaseline | null>(null);
  const [minKnee, setMinKnee] = useState<number | null>(null);
  const [overlayPose, setOverlayPose] = useState<PoseFrame | null>(null);
  const [error, setError] = useState<string | null>(null);

  const standingSamplesRef = useRef<StandingSample[]>([]);
  const minKneeRef = useRef<number | null>(null);
  const lastFrameTs = useRef(0);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => undefined);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
    };
  }, []);

  // Phase-driven countdown / auto-transition.
  useEffect(() => {
    const phaseDuration: Partial<Record<Phase, number>> = {
      'standing-prep': STANDING_PREP_SEC,
      'standing-capture': STANDING_CAPTURE_SEC,
      'squat-prep': SQUAT_PREP_SEC,
      'squat-capture': SQUAT_CAPTURE_SEC,
    };
    const total = phaseDuration[phase];
    if (total == null) return;

    setSecondsLeft(total);
    const startTs = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTs) / 1000;
      setSecondsLeft(Math.max(0, Math.ceil(total - elapsed)));
      if (elapsed >= total) {
        clearInterval(interval);
        advancePhase();
      }
    }, 100);
    return () => clearInterval(interval);
    // advancePhase is stable closure over phase
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function advancePhase() {
    setPhase((p) => {
      switch (p) {
        case 'standing-prep':
          return 'standing-capture';
        case 'standing-capture': {
          const samples = standingSamplesRef.current;
          const next = buildStandingBaseline(samples);
          if (!next || next.sampleCount < MIN_STANDING_SAMPLES) {
            setError(`서 있는 자세가 안정적으로 인식되지 않았습니다 (${samples.length} samples). 다시 시도하세요.`);
            return 'instructions';
          }
          setBaseline(next);
          return 'squat-prep';
        }
        case 'squat-prep':
          return 'squat-capture';
        case 'squat-capture':
          return 'review';
        default:
          return p;
      }
    });
  }

  const handlePose = useCallback(
    (pose: PoseFrame) => {
      const now = Date.now();
      if (now - lastFrameTs.current < 80) return;
      lastFrameTs.current = now;
      setOverlayPose(pose);

      if (phase === 'standing-capture') {
        const s = extractStandingSample(pose);
        if (s) standingSamplesRef.current.push(s);
      } else if (phase === 'squat-capture') {
        const metrics = analyzeSquatFrame(pose);
        if (!metrics.reliable) return;
        if (minKneeRef.current == null || metrics.kneeAngle < minKneeRef.current) {
          minKneeRef.current = metrics.kneeAngle;
          setMinKnee(metrics.kneeAngle);
        }
      }
    },
    [phase],
  );

  const reset = () => {
    standingSamplesRef.current = [];
    minKneeRef.current = null;
    setBaseline(null);
    setMinKnee(null);
    setError(null);
  };

  const startCalibration = () => {
    reset();
    setPhase('standing-prep');
  };

  const retry = () => {
    reset();
    setPhase('standing-prep');
  };

  const save = async () => {
    if (!baseline || minKnee == null) return;
    setPhase('saving');
    try {
      await saveSquatCalibration({
        maxKneeAngle: Number(minKnee.toFixed(2)),
        minKneeAngle: Number(baseline.minKneeAngle.toFixed(2)),
        neutralTrunkTilt: Number(baseline.neutralTrunkTilt.toFixed(2)),
        neutralAsymmetry: Number(baseline.neutralAsymmetry.toFixed(2)),
        neutralKneeCaveIndex: Number(baseline.neutralKneeCaveIndex.toFixed(4)),
        femurTorsoRatio: Number(baseline.femurTorsoRatio.toFixed(3)),
      });
      setPhase('saved');
      setTimeout(
        () => router.replace({ pathname: '/setup/[id]', params: { id: ex?.id ?? 'squat' } }),
        800,
      );
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

  const skeletonColor =
    phase === 'standing-capture' || phase === 'squat-capture' ? theme.formGood : '#FFFFFF';

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <PoseCameraView active={true} onPose={handlePose} />
      <SkeletonOverlay pose={overlayPose} color={skeletonColor} />

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
              본인 체형 측정
            </ThemedText>
          </View>
        </View>

        <View style={[styles.panel, { backgroundColor: theme.background + 'D9', borderColor: theme.border }]}>
          <PhaseBody
            phase={phase}
            secondsLeft={secondsLeft}
            baseline={baseline}
            minKnee={minKnee}
            error={error}
            onStart={startCalibration}
            onRetry={retry}
            onSave={save}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

interface PhaseBodyProps {
  phase: Phase;
  secondsLeft: number;
  baseline: StandingBaseline | null;
  minKnee: number | null;
  error: string | null;
  onStart: () => void;
  onRetry: () => void;
  onSave: () => void;
}

function PhaseBody({ phase, secondsLeft, baseline, minKnee, error, onStart, onRetry, onSave }: PhaseBodyProps) {
  const theme = useTheme();

  switch (phase) {
    case 'instructions':
      return (
        <>
          <ThemedText type="heading">본인 체형을 측정합니다</ThemedText>
          <ThemedText type="body" themeColor="textSecondary">
            2단계로 진행됩니다.{'\n'}
            ① 측면을 향해 편하게 서 주세요 ({STANDING_CAPTURE_SEC}초){'\n'}
            ② 그 다음 최대한 깊이 한 번 앉아주세요 ({SQUAT_CAPTURE_SEC}초)
          </ThemedText>
          {error && <ThemedText type="small" themeColor="formDanger">{error}</ThemedText>}
          <Pressable
            onPress={onStart}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <ThemedText type="heading" themeColor="background">시작</ThemedText>
          </Pressable>
        </>
      );

    case 'standing-prep':
      return (
        <>
          <ThemedText type="caption" themeColor="textSecondary">① 측면으로 서기 — 준비</ThemedText>
          <ThemedText type="display">{secondsLeft}</ThemedText>
        </>
      );

    case 'standing-capture':
      return (
        <>
          <ThemedText type="caption" themeColor="formGood">① 측정중 · {secondsLeft}s</ThemedText>
          <ThemedText type="body">편하게 서 주세요</ThemedText>
        </>
      );

    case 'squat-prep':
      return (
        <>
          <ThemedText type="caption" themeColor="textSecondary">② 최대 깊이 스쿼트 — 준비</ThemedText>
          <ThemedText type="display">{secondsLeft}</ThemedText>
          {baseline && (
            <ThemedText type="small" themeColor="textSecondary">
              서있는 자세 기록됨 ({baseline.sampleCount}프레임)
            </ThemedText>
          )}
        </>
      );

    case 'squat-capture':
      return (
        <>
          <ThemedText type="caption" themeColor="formGood">② 측정중 · {secondsLeft}s</ThemedText>
          <ThemedText type="body">최대한 깊이 앉아보세요</ThemedText>
          <ThemedText type="title">
            {minKnee != null ? `${Math.round(minKnee)}°` : '--°'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">현재 최저 무릎 각도</ThemedText>
        </>
      );

    case 'review':
      return (
        <>
          <ThemedText type="caption" themeColor="textSecondary">측정 결과</ThemedText>
          {baseline && (
            <>
              <Row label="서있는 무릎" value={`${Math.round(baseline.minKneeAngle)}°`} />
              <Row label="최대 깊이" value={minKnee != null ? `${Math.round(minKnee)}°` : '—'} />
              <Row label="평상시 상체 기울기" value={`${baseline.neutralTrunkTilt.toFixed(1)}°`} />
              <Row label="좌우 비대칭" value={`${baseline.neutralAsymmetry.toFixed(1)}°`} />
              <Row label="다리/상체 비율" value={baseline.femurTorsoRatio.toFixed(2)} />
            </>
          )}
          {error && <ThemedText type="small" themeColor="formDanger">{error}</ThemedText>}
          <View style={styles.row}>
            <Pressable
              onPress={onRetry}
              style={({ pressed }) => [
                styles.secondary,
                { borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <ThemedText type="bodyEmphasis">다시</ThemedText>
            </Pressable>
            <Pressable
              onPress={onSave}
              disabled={minKnee == null || !baseline}
              style={({ pressed }) => [
                styles.primary,
                {
                  backgroundColor: minKnee != null && baseline ? theme.accent : theme.backgroundElement,
                  opacity: pressed && minKnee != null && baseline ? 0.85 : 1,
                },
              ]}
            >
              <ThemedText
                type="heading"
                themeColor={minKnee != null && baseline ? 'background' : 'textMuted'}
              >
                저장
              </ThemedText>
            </Pressable>
          </View>
        </>
      );

    case 'saving':
      return (
        <View style={styles.saving}>
          <ActivityIndicator color={theme.accent} />
          <ThemedText type="body" themeColor="textSecondary">저장중...</ThemedText>
        </View>
      );

    case 'saved':
      return <ThemedText type="heading" themeColor="formGood">저장됨 ✓</ThemedText>;
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kvRow}>
      <ThemedText type="caption" themeColor="textSecondary">{label}</ThemedText>
      <ThemedText type="bodyEmphasis">{value}</ThemedText>
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
    minWidth: 340,
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.two },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
  saving: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
});
