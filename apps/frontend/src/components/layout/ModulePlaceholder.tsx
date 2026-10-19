import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface ModulePlaceholderProps {
  title: string;
  description: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}

/**
 * Esqueleto temporal de módulo: cabecera + mensaje de estado.
 * Se sustituye por la pantalla real del módulo en la Fase 4.
 */
export function ModulePlaceholder({ title, description, icon = 'construct-outline' }: ModulePlaceholderProps) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, theme.shadow]}>
        <Ionicons name={icon} size={30} color={c.primary} />
        <Text style={[styles.desc, { color: c.textMuted }]}>{description}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 16 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  desc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
