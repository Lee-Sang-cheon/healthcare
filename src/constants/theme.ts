import { Platform } from 'react-native';

/**
 * Design tokens for "차분한 전문가" tone — monochrome base + single teal accent.
 * Dark mode is the primary mode (workout screen runs dark, away from camera-glare distractions).
 */

const palette = {
  ink: {
    0: '#FFFFFF',
    50: '#F5F6F7',
    100: '#E6E8EB',
    200: '#CED2D8',
    300: '#A4ABB5',
    400: '#737A85',
    500: '#4F555F',
    600: '#363A42',
    700: '#23262C',
    800: '#16181C',
    900: '#0B0C0E',
  },
  teal: {
    300: '#5EEAD4',
    400: '#2DD4BF',
    500: '#14B8A6',
    600: '#0D9488',
    700: '#0F766E',
  },
  amber: { 400: '#F59E0B', 500: '#D97706' },
  rose: { 400: '#F43F5E', 500: '#E11D48' },
  emerald: { 400: '#10B981', 500: '#059669' },
} as const;

export const Colors = {
  light: {
    text: palette.ink[900],
    textSecondary: palette.ink[500],
    textMuted: palette.ink[400],
    background: palette.ink[0],
    backgroundElement: palette.ink[50],
    backgroundSelected: palette.ink[100],
    border: palette.ink[200],
    accent: palette.teal[600],
    accentMuted: palette.teal[500],
    formGood: palette.emerald[500],
    formWarn: palette.amber[500],
    formDanger: palette.rose[500],
  },
  dark: {
    text: palette.ink[0],
    textSecondary: palette.ink[300],
    textMuted: palette.ink[400],
    background: palette.ink[900],
    backgroundElement: palette.ink[800],
    backgroundSelected: palette.ink[700],
    border: palette.ink[700],
    accent: palette.teal[400],
    accentMuted: palette.teal[500],
    formGood: palette.emerald[400],
    formWarn: palette.amber[400],
    formDanger: palette.rose[400],
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Type scale — used inside ThemedText `type` prop variants. Bigger steps for workout HUD readability at 1.5m. */
export const TypeScale = {
  display: { fontSize: 96, lineHeight: 100, fontWeight: '600' as const, letterSpacing: -2 },
  hero: { fontSize: 56, lineHeight: 60, fontWeight: '600' as const, letterSpacing: -1 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '600' as const },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  bodyEmphasis: { fontSize: 16, lineHeight: 22, fontWeight: '500' as const },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  caption: { fontSize: 11, lineHeight: 14, fontWeight: '500' as const, letterSpacing: 0.5 },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 720;

export const Radius = { sm: 6, md: 10, lg: 16, xl: 24, pill: 999 } as const;
