import { StyleSheet, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

interface Props {
  /** Per-rep form scores in chronological order. Null treated as 0. */
  scores: Array<number | null>;
  /** Set boundaries by rep index (0-based). Drawn as faint vertical separators. */
  setBoundaries?: number[];
  height?: number;
}

/**
 * Tiny SVG bar chart of per-rep form scores. Bars are colored by score band
 * (≥80 good, ≥60 warn, else danger) so the user can scan reps for
 * deterioration over the session.
 */
export function RepScoreChart({ scores, setBoundaries = [], height = 120 }: Props) {
  const theme = useTheme();
  const safeScores = scores.map((s) => (s ?? 0));
  if (safeScores.length === 0) {
    return (
      <View style={{ height, justifyContent: 'center', alignItems: 'center' }}>
        <ThemedText type="small" themeColor="textSecondary">렙 점수 없음</ThemedText>
      </View>
    );
  }

  const w = 100;
  const h = 100;
  const barGap = 2;
  const barWidth = Math.max(2, (w - barGap * (safeScores.length - 1)) / safeScores.length);

  return (
    <View style={styles.wrap}>
      <Svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height, alignSelf: 'stretch' }}
      >
        {/* y-axis tick at 80 (good threshold) */}
        <Line x1={0} y1={h - (80 / 100) * h} x2={w} y2={h - (80 / 100) * h} stroke={theme.border} strokeWidth={0.3} strokeDasharray="1 1" />
        {/* y-axis tick at 60 (warn threshold) */}
        <Line x1={0} y1={h - (60 / 100) * h} x2={w} y2={h - (60 / 100) * h} stroke={theme.border} strokeWidth={0.3} strokeDasharray="1 1" />

        {setBoundaries.map((idx, i) => {
          const x = (idx) * (barWidth + barGap);
          return (
            <Line
              key={`sb${i}`}
              x1={x}
              y1={0}
              x2={x}
              y2={h}
              stroke={theme.textMuted}
              strokeWidth={0.4}
              strokeDasharray="2 2"
              opacity={0.5}
            />
          );
        })}

        {safeScores.map((s, i) => {
          const x = i * (barWidth + barGap);
          const barH = (s / 100) * h;
          const y = h - barH;
          const color = s >= 80 ? theme.formGood : s >= 60 ? theme.formWarn : theme.formDanger;
          return (
            <Rect
              key={`bar${i}`}
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              fill={color}
              rx={0.5}
            />
          );
        })}
      </Svg>
      <View style={styles.legend}>
        <ThemedText type="caption" themeColor="textSecondary">0</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">렙별 폼 점수</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">100</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.one,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
