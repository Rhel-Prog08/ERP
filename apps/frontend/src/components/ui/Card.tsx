import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  /** Acciones alineadas a la derecha del título (botones, filtros...). */
  actions?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Tarjeta empresarial del sistema de diseño CodeEvo. */
export function Card({ children, title, actions, style, contentStyle }: CardProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
        theme.shadow,
        style,
      ]}
    >
      {(title || actions) && (
        <View style={styles.header}>
          {title ? (
            <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
              {title}
            </Text>
          ) : (
            <View />
          )}
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>
      )}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 12,
  },
  title: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  content: { paddingHorizontal: 16, paddingBottom: 16 },
});
