import { Link, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { exercises } from '@/features/exercises/registry';
import { useTheme } from '@/hooks/use-theme';

export default function ExercisesScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: '운동 선택', headerBackTitle: '뒤로' }} />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.list}>
          {exercises.map((ex) => {
            const inner = (
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  !ex.enabled && styles.cardDisabled,
                ]}
              >
                <View style={styles.cardHead}>
                  <ThemedText type="heading">{ex.name}</ThemedText>
                  {!ex.enabled && (
                    <ThemedText type="caption" themeColor="textMuted">곧 출시</ThemedText>
                  )}
                </View>
                <ThemedText type="body" themeColor="textSecondary">
                  {ex.shortDescription}
                </ThemedText>
              </View>
            );

            if (!ex.enabled) return <View key={ex.id}>{inner}</View>;
            return (
              <Link key={ex.id} href={{ pathname: '/setup/[id]', params: { id: ex.id } }} asChild>
                <Pressable>{inner}</Pressable>
              </Link>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  list: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  card: {
    padding: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDisabled: { opacity: 0.5 },
});
