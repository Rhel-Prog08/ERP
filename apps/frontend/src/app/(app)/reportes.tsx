import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { downloadCsv, requestCsv, toApiError } from '../../services/apiClient';
import { REPORT_KEYS, REPORT_LABELS, reportsService } from '../../services/reportsService';
import type { ReportKey, ReportResult, ReportRow } from '../../types/models';
import type { QueryParams } from '../../types/api';
import { formatCurrency, formatNumber } from '../../utils/format';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable, type TableColumn } from '../../components/ui/DataTable';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';

/** Fecha válida si vacía o con formato AAAA-MM-DD. */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Claves de dinero típicas del backend (no se formatea nada más). */
const MONEY_KEY_RE = /(subtotal|total|price|revenue|amount)/i;

/**
 * Sólo estos informes admiten dateFrom/dateTo en el backend
 * (ventas, compras, movimientos y auditoría); el resto los ignora.
 */
const DATE_FILTER_KEYS: ReadonlySet<ReportKey> = new Set<ReportKey>([
  'sales',
  'purchases',
  'movements',
  'audit',
]);

/** 'saleTotal' → 'Sale Total' (sólo presentación de la cabecera). */
function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (ch) => ch.toUpperCase());
}

interface IndexedRow {
  index: number;
  data: ReportRow;
}

/** Reportes: 8 informes reales de /api/v1/reports con exportación CSV. */
export default function ReportesScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const toast = useToast();
  const { can } = useAuth();

  const [reportKey, setReportKey] = useState<ReportKey>('sales');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterErrors, setFilterErrors] = useState<{
    dateFrom?: string;
    dateTo?: string;
  }>({});

  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const supportsDates = DATE_FILTER_KEYS.has(reportKey);

  const buildParams = (key: ReportKey): QueryParams => {
    const params: QueryParams = {};
    if (DATE_FILTER_KEYS.has(key)) {
      if (dateFrom.trim()) params.dateFrom = dateFrom.trim();
      if (dateTo.trim()) params.dateTo = dateTo.trim();
    }
    return params;
  };

  const validateDates = (): boolean => {
    const errors: { dateFrom?: string; dateTo?: string } = {};
    if (supportsDates && dateFrom.trim() && !DATE_RE.test(dateFrom.trim())) {
      errors.dateFrom = 'Formato AAAA-MM-DD';
    }
    if (supportsDates && dateTo.trim() && !DATE_RE.test(dateTo.trim())) {
      errors.dateTo = 'Formato AAAA-MM-DD';
    }
    setFilterErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const generate = async (key: ReportKey = reportKey) => {
    if (!validateDates()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await reportsService.run(key, buildParams(key));
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(toApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const download = await requestCsv(`/reports/${reportKey}`, buildParams(reportKey));
      if (downloadCsv(download)) {
        toast.success('CSV descargado correctamente');
      } else {
        toast.error('La descarga no está disponible en esta plataforma');
      }
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setExporting(false);
    }
  };

  if (!can('reports.read')) {
    return (
      <ScrollView contentContainerStyle={styles.wrap}>
        <ScreenHeader title="Reportes" subtitle="Informes del ERP" />
        <Card>
          <Text style={[styles.noPermission, { color: c.textMuted }]}>
            No tienes permiso para ver reportes. Contacta con tu administrador si necesitas acceso.
          </Text>
        </Card>
      </ScrollView>
    );
  }

  // Columnas dinámicas: claves de la primera fila del informe.
  const columns: TableColumn<IndexedRow>[] = result
    ? Object.keys(result.rows[0] ?? {}).map((key) => ({
        key,
        label: humanizeKey(key),
        render: (row: IndexedRow) => {
          const value = row.data[key];
          if (typeof value === 'number') {
            return (
              <Text style={[styles.cell, { color: c.text }]}>
                {MONEY_KEY_RE.test(key) ? formatCurrency(value) : formatNumber(value)}
              </Text>
            );
          }
          return <Text style={[styles.cell, { color: c.text }]}>{String(value ?? '')}</Text>;
        },
      }))
    : [];

  const indexedRows: IndexedRow[] = result
    ? result.rows.map((data, index) => ({ index, data }))
    : [];

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <ScreenHeader
        title="Reportes"
        subtitle={result ? `${result.count} ${result.count === 1 ? 'resultado' : 'resultados'}` : 'Genera y exporta informes'}
      />

      {/* Selector de informe y filtros */}
      <Card>
        <View style={styles.filters}>
          <View style={styles.filterCol}>
            <Select<ReportKey>
              label="Informe"
              value={reportKey}
              options={REPORT_KEYS.map((key) => ({ value: key, label: REPORT_LABELS[key] }))}
              onChange={(key) => {
                setReportKey(key);
                setResult(null);
                setError(null);
                setFilterErrors({});
              }}
            />
          </View>
          {supportsDates ? (
            <>
              <View style={styles.filterCol}>
                <Input
                  label="Desde"
                  value={dateFrom}
                  onChangeText={setDateFrom}
                  placeholder="AAAA-MM-DD"
                  error={filterErrors.dateFrom}
                  keyboardType="numbers-and-punctuation"
                  editable={!loading}
                />
              </View>
              <View style={styles.filterCol}>
                <Input
                  label="Hasta"
                  value={dateTo}
                  onChangeText={setDateTo}
                  placeholder="AAAA-MM-DD"
                  error={filterErrors.dateTo}
                  keyboardType="numbers-and-punctuation"
                  editable={!loading}
                />
              </View>
            </>
          ) : null}
          <View style={styles.filterCol}>
            <Button title="Generar" onPress={() => void generate()} loading={loading} />
          </View>
          {can('reports.export') ? (
            <View style={styles.filterCol}>
              <Button
                title="Exportar CSV"
                variant="secondary"
                onPress={() => void exportCsv()}
                disabled={result === null}
                loading={exporting}
              />
            </View>
          ) : null}
        </View>
      </Card>

      {/* Resultados */}
      <Card style={styles.section}>
        {loading ? (
          <LoadingState message="Generando informe…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void generate()} />
        ) : !result ? (
          <EmptyState
            title="Sin resultados"
            message="Selecciona un informe y pulsa «Generar» para ver los datos."
          />
        ) : result.count === 0 ? (
          <EmptyState
            title="Sin resultados"
            message="El informe no ha devuelto registros con los filtros aplicados."
          />
        ) : (
          <DataTable columns={columns} rows={indexedRows} rowKey={(row) => String(row.index)} />
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 40 },
  filters: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' },
  filterCol: { flexGrow: 1, minWidth: 170 },
  section: { marginTop: 16 },
  cell: { fontSize: 14 },
  noPermission: { fontSize: 14, textAlign: 'center', paddingVertical: 8 },
});
