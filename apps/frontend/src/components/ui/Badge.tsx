import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import type { BadgeTone } from '../../constants/statuses';

const TONE_STYLES: Record<BadgeTone, { fg: string; bg: string }> = {
  success: { fg: '#166534', bg: '#dcfce7' },
  warning: { fg: '#92400e', bg: '#fef3c7' },
  danger: { fg: '#991b1b', bg: '#fee2e2' },
  neutral: { fg: '#334155', bg: '#e2e8f0' },
  info: { fg: '#1e40af', bg: '#dbeafe' },
};

const TONE_STYLES_DARK: Record<BadgeTone, { fg: string; bg: string }> = {
  success: { fg: '#bbf7d0', bg: '#052e1b' },
  warning: { fg: '#fde68a', bg: '#3b2a06' },
  danger: { fg: '#fecaca', bg: '#3f0d0d' },
  neutral: { fg: '#cbd5e1', bg: '#1e293b' },
  info: { fg: '#bfdbfe', bg: '#0c1e3a' },
};

/** Badge de estado (semáforo) del ERP. */
export function Badge({ label, tone }: { label: string; tone: BadgeTone }) {
  const theme = useTheme();
  const palette = theme.scheme === 'dark' ? TONE_STYLES_DARK : TONE_STYLES;
  const { fg, bg } = palette[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  label: { fontSize: 12, fontWeight: '700' },
});
