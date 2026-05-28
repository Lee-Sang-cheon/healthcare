import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors } from '@/constants/theme';

export default function RootLayout() {
  const scheme = useColorScheme() ?? 'dark';

  const navTheme =
    scheme === 'dark'
      ? {
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            background: Colors.dark.background,
            card: Colors.dark.background,
            text: Colors.dark.text,
            border: Colors.dark.border,
            primary: Colors.dark.accent,
          },
        }
      : {
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            background: Colors.light.background,
            card: Colors.light.background,
            text: Colors.light.text,
            border: Colors.light.border,
            primary: Colors.light.accent,
          },
        };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navTheme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: navTheme.colors.background },
          }}
        />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
