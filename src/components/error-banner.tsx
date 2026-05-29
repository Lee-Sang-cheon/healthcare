import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

interface Props {
  message: string | null;
  onDismiss?: () => void;
  /** Auto-dismiss after this many ms. 0 disables auto-dismiss. */
  autoDismissMs?: number;
}

/**
 * A persistent error pill that floats near the top of the screen. Visible
 * whenever `message` is non-null. Auto-dismisses after `autoDismissMs`
 * (default 6s) by calling `onDismiss`.
 *
 * Intended for failures that affect the current screen — network errors,
 * auth failures — but not so critical that the user must stop. Cmp. throwing,
 * which would unmount the screen entirely.
 */
export function ErrorBanner({ message, onDismiss, autoDismissMs = 6000 }: Props) {
  const theme = useTheme();

  useEffect(() => {
    if (!message || !onDismiss || autoDismissMs <= 0) return;
    const t = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(t);
  }, [message, onDismiss, autoDismissMs]);

  if (!message) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View
        style={[
          styles.pill,
          { backgroundColor: theme.formDanger, borderColor: theme.border },
        ]}
      >
        <ThemedText type="small" themeColor="background">{message}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: Spacing.four,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  pill: {
    maxWidth: '90%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
