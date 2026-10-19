import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Botones/filtros alineados a la derecha. */
  actions?: React.ReactNode;
}

/** Cabecera estándar de un módulo (título + acciones). */
export function ScreenHeader({ title, subtitle, actions }: ScreenHeaderProps) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.wrap}>
      <View style={styles.titles}>
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: c.textMuted }]}>{subtitle}</Text>
        ) : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  titles: { gap: 2, flexShrink: 1 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 14 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
