import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { auditService } from '../../services/auditService';
import { PERMISSIONS } from '../../constants/permissions';
import { AUDIT_ACTIONS, AUDIT_MODULES, auditActionTone } from '../../constants/statuses';
import type { QueryParams } from '../../types/api';
import type { AuditLog } from '../../types/models';
import { formatDateTime } from '../../utils/format';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { DataTable, type TableColumn } from '../../components/ui/DataTable';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';

/** Formato de fecha de filtro: AAAA-MM-DD (lo admite el backend como date). */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Vacío = sin filtro; con texto debe ser AAAA-MM-DD y una fecha real. */
function isInvalidDate(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '') return false;
  if (!DATE_PATTERN.test(trimmed)) return true;
  const [year, month, day] = trimmed.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  );
}

/** 'users' → 'Users' (etiquetas de módulo en la interfaz). */
function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '—';
}

/**
 * Bitácora de SOLO LECTURA (GET /audit, permiso audit.read).
 * Filtros: acción, módulo y rango de fechas. No existe escritura:
 * los registros los genera el backend con recordAudit().
 */
export default function AuditoriaScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const { can } = useAuth();

  const canRead = can(PERMISSIONS.AUDIT_READ);

  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fromInvalid = isInvalidDate(dateFrom);
  const toInvalid = isInvalidDate(dateTo);

  const fetcher = useCallback(
    // Sin permiso no se lanza la petición: se muestra el aviso de acceso denegado.
    (params: QueryParams) =>
      canRead ? auditService.list(params) : Promise.reject(new Error('Acceso denegado')),
    [canRead]
  );

  const list = usePaginatedList<AuditLog>(fetcher, {
    filters: {
      action: actionFilter ?? undefined,
      module: moduleFilter ?? undefined,
      // Nunca se envían fechas con formato inválido.
      dateFrom: !fromInvalid && dateFrom.trim() ? dateFrom.trim() : undefined,
      dateTo: !toInvalid && dateTo.trim() ? dateTo.trim() : undefined,
    },
  });

  const cell = (text: string) => (
    <Text style={{ color: c.text, fontSize: 14 }} numberOfLines={2}>
      {text}
    </Text>
  );

  const columns: TableColumn<AuditLog>[] = [
    {
      key: 'createdAt',
      label: 'Fecha',
      width: 150,
      render: (row) => cell(formatDateTime(row.createdAt)),
    },
    {
      key: 'user',
      label: 'Usuario',
      width: 210,
      render: (row) => {
        const user = row.userId;
        if (!user || typeof user === 'string') return cell('—');
        const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
        return cell(name || user.email || '—');
      },
    },
    {
      key: 'action',
      label: 'Acción',
      width: 180,
      render: (row) => <Badge label={row.action} tone={auditActionTone(row.action)} />,
    },
    {
      key: 'module',
      label: 'Módulo',
      width: 130,
      render: (row) => cell(capitalize(row.module)),
    },
    {
      key: 'description',
      label: 'Descripción',
      render: (row) => cell(row.description?.trim() || '—'),
    },
  ];

  /* --------------------------- Acceso denegado --------------------------- */
  if (!canRead) {
    return (
      <ScrollView contentContainerStyle={styles.wrap}>
        <ScreenHeader title="Auditoría" subtitle="Bitácora de solo lectura" />
        <Card title="Acceso denegado">
          <Text style={{ color: c.textMuted, fontSize: 14, lineHeight: 20 }}>
            No tienes permiso para consultar la bitácora (audit.read). Si necesitas acceso,
            solicítalo a un administrador del sistema.
          </Text>
        </Card>
      </ScrollView>
    );
  }

  const hasFilters =
    Boolean(actionFilter) || Boolean(moduleFilter) || Boolean(dateFrom.trim()) || Boolean(dateTo.trim());

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <ScreenHeader
        title="Auditoría"
        subtitle={`${list.total} ${list.total === 1 ? 'registro' : 'registros'} en la bitácora`}
      />

      <Card>
        <View style={styles.toolbar}>
          <View style={styles.filter}>
            <Select
              label="Acción"
              value={actionFilter}
              options={[
                { value: '', label: 'Todas' },
                ...AUDIT_ACTIONS.map((action) => ({ value: action, label: action })),
              ]}
              onChange={(value) => setActionFilter(value || null)}
              placeholder="Todas"
            />
          </View>
          <View style={styles.filter}>
            <Select
              label="Módulo"
              value={moduleFilter}
              options={[
                { value: '', label: 'Todos' },
                ...AUDIT_MODULES.map((m) => ({ value: m, label: capitalize(m) })),
              ]}
              onChange={(value) => setModuleFilter(value || null)}
              placeholder="Todos"
            />
          </View>
          <Input
            label="Fecha desde"
            value={dateFrom}
            onChangeText={setDateFrom}
            keyboardType="numeric"
            placeholder="AAAA-MM-DD"
            error={fromInvalid ? 'Formato inválido (AAAA-MM-DD). No se aplicará el filtro.' : undefined}
            containerStyle={styles.dateField}
          />
          <Input
            label="Fecha hasta"
            value={dateTo}
            onChangeText={setDateTo}
            keyboardType="numeric"
            placeholder="AAAA-MM-DD"
            error={toInvalid ? 'Formato inválido (AAAA-MM-DD). No se aplicará el filtro.' : undefined}
            containerStyle={styles.dateField}
          />
        </View>

        {list.loading && list.items.length === 0 ? (
          <LoadingState message="Cargando bitácora…" />
        ) : list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : list.items.length === 0 ? (
          <EmptyState
            title="Sin registros"
            message={
              hasFilters
                ? 'Ningún registro coincide con los filtros aplicados.'
                : 'Todavía no hay actividad registrada en la bitácora.'
            }
          />
        ) : (
          <>
            <DataTable columns={columns} rows={list.items} rowKey={(row) => row._id} />
            <Pagination
              page={list.page}
              totalPages={list.totalPages}
              total={list.total}
              onPageChange={list.setPage}
              loading={list.loading}
            />
          </>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 40 },
  toolbar: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 },
  filter: { width: 190 },
  dateField: { width: 190 },
});
