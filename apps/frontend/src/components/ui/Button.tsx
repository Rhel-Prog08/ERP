import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Icono opcional a la izquierda del texto (@expo/vector-icons element). */
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const c = theme.colors;
  const inactive = disabled || loading;

  const bg: Record<ButtonVariant, string> = {
    primary: c.primary,
    secondary: c.card,
    ghost: 'transparent',
    danger: c.danger,
  };
  const fg: Record<ButtonVariant, string> = {
    primary: '#ffffff',
    secondary: c.primary,
    ghost: c.textMuted,
    danger: '#ffffff',
  };
  const border: Record<ButtonVariant, string> = {
    primary: c.primary,
    secondary: c.border,
    ghost: 'transparent',
    danger: c.danger,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        {
          backgroundColor: bg[variant],
          borderColor: border[variant],
          opacity: inactive ? 0.55 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg[variant]} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.label,
              size === 'sm' ? styles.labelSm : styles.labelMd,
              { color: fg[variant] },
              icon ? { marginLeft: 6 } : null,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
  },
  sm: { paddingVertical: 7, paddingHorizontal: 12 },
  md: { paddingVertical: 11, paddingHorizontal: 16 },
  label: { fontWeight: '600' },
  labelSm: { fontSize: 13 },
  labelMd: { fontSize: 14 },
});
