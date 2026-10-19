import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Button } from './Button';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

/** Paginación de listados (page/limit del backend). */
export function Pagination({ page, totalPages, total, onPageChange, loading }: PaginationProps) {
  const theme = useTheme();
  const c = theme.colors;
  if (totalPages <= 1) {
    return total > 0 ? (
      <Text style={[styles.summary, { color: c.textMuted }]}>
        {total} {total === 1 ? 'registro' : 'registros'}
      </Text>
    ) : null;
  }

  return (
    <View style={styles.wrap}>
      <Button
        title="Anterior"
        variant="secondary"
        size="sm"
        disabled={loading || page <= 1}
        onPress={() => onPageChange(page - 1)}
      />
      <Text style={[styles.summary, { color: c.textMuted }]}>
        Página {page} de {totalPages} · {total} registros
      </Text>
      <Button
        title="Siguiente"
        variant="secondary"
        size="sm"
        disabled={loading || page >= totalPages}
        onPress={() => onPageChange(page + 1)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  summary: { fontSize: 13, flexShrink: 1, textAlign: 'center' },
});
