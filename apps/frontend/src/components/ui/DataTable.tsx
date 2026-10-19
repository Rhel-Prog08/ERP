import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export interface TableColumn<T> {
  key: string;
  label: string;
  /** Ancho mínimo de la columna (dp). */
  width?: number;
  /** Renderizado personalizado de la celda (por defecto, String(value)). */
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
}

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Pinta filas alternas para lectura enterprise. */
  striped?: boolean;
}

/**
 * Tabla con scroll horizontal (web y móvil). Las celdas se apilan en
 * tarjetas cuando no hay espacio suficiente gracias al ScrollView.
 */
export function DataTable<T>({ columns, rows, rowKey, striped = true }: DataTableProps<T>) {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.table}>
        {/* Cabecera */}
        <View style={[styles.row, { backgroundColor: theme.scheme === 'dark' ? c.border : c.primaryLight }]}>
          {columns.map((col) => (
            <View
              key={col.key}
              style={[styles.cell, col.width ? { width: col.width } : styles.flex, colAlign(col.align)]}
            >
              <Text style={[styles.headerLabel, { color: c.primary }]} numberOfLines={2}>
                {col.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Filas */}
        {rows.map((row, index) => (
          <View
            key={rowKey(row)}
            style={[
              styles.row,
              {
                backgroundColor: striped && index % 2 === 1 ? c.bg : c.card,
                borderColor: c.border,
              },
            ]}
          >
            {columns.map((col) => (
              <View
                key={col.key}
                style={[styles.cell, col.width ? { width: col.width } : styles.flex, colAlign(col.align)]}
              >
                {col.render ? (
                  col.render(row)
                ) : (
                  <Text style={[styles.cellText, { color: c.text }]} numberOfLines={2}>
                    {formatCell(row, col.key)}
                  </Text>
                )}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function colAlign(align?: 'left' | 'right' | 'center') {
  if (align === 'right') return { alignItems: 'flex-end' as const };
  if (align === 'center') return { alignItems: 'center' as const };
  return { alignItems: 'flex-start' as const };
}

/** Lee una propiedad anidada simple ('customer.name') o la raíz. */
function formatCell(row: unknown, key: string): string {
  let value: unknown = row;
  for (const part of key.split('.')) {
    if (value === null || typeof value !== 'object') return '—';
    value = (value as Record<string, unknown>)[part];
  }
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object' && '_id' in (value as object)) {
    const obj = value as Record<string, unknown>;
    return String(obj.name ?? obj.firstName ?? obj._id);
  }
  return String(value);
}

const styles = StyleSheet.create({
  table: { minWidth: '100%' },
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  cell: {
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  flex: { flex: 1 },
  headerLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  cellText: { fontSize: 14 },
});
