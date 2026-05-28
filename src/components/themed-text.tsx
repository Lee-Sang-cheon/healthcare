import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor, TypeScale } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextVariant = keyof typeof TypeScale | 'code';

export type ThemedTextProps = TextProps & {
  type?: TextVariant;
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'body', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const variantStyle = type === 'code' ? styles.code : TypeScale[type];

  return <Text style={[{ color: theme[themeColor ?? 'text'] }, variantStyle, style]} {...rest} />;
}

const styles = StyleSheet.create({
  code: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    lineHeight: 18,
  },
});
