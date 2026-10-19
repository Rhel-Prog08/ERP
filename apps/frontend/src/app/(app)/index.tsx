import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { toApiError } from '../../services/apiClient';
import { dashboardService } from '../../services/dashboardService';
import type { Dashboard } from '../../types/models';
import { formatCurrency, formatDateTime, formatNumber } from '../../utils/format';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { useResponsive } from '../../hooks/useResponsive';
import { SALE_STATUS_BADGES, PURCHASE_STATUS_BADGES } from '../../constants/statuses';

/** Dashboard: indicadores REALES de GET /api/v1/dashboard (sin cifras ficticias). */
export default function DashboardScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const { user } = useAuth();
  const { isDesktop, isTablet } = useResponsive();

  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    dashboardService
      .get()
      .then((d) => setData(d))
      .catch((err) => setError(toApiError(err).message))
      .finally(() => setLoading(false));
  }, []);

  /** Recarga manual (evento): fuerza estado de carga y vuelve a pedir. */
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchData();
  }, [fetchData]);

  // Carga inicial: el estado arranca en loading=true, así que el efecto
  // sólo dispara la petición (los setState ocurren en callbacks async).
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !data) return <LoadingState message="Cargando indicadores…" />;
  if (error && !data) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const kpiWidth = isDesktop ? '23%' : isTablet ? '48%' : '100%';
  const kpis: { key: string; label: string; value: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { key: 'salesToday', label: 'Ventas de hoy', value: formatCurrency(data.kpi.salesToday), icon: 'trending-up-outline' },
    { key: 'salesMonth', label: 'Ventas del mes', value: formatCurrency(data.kpi.salesMonth), icon: 'cart-outline' },
    { key: 'purchasesMonth', label: 'Compras del mes', value: formatCurrency(data.kpi.purchasesMonth), icon: 'bag-handle-outline' },
    { key: 'totalProducts', label: 'Productos', value: formatNumber(data.kpi.totalProducts, 0), icon: 'cube-outline' },
    { key: 'lowStockCount', label: 'Stock mínimo', value: formatNumber(data.kpi.lowStockCount, 0), icon: 'alert-circle-outline' },
    { key: 'totalCustomers', label: 'Clientes', value: formatNumber(data.kpi.totalCustomers, 0), icon: 'people-outline' },
    { key: 'totalSuppliers', label: 'Proveedores', value: formatNumber(data.kpi.totalSuppliers, 0), icon: 'business-outline' },
    { key: 'salesTodayCount', label: 'Nº de ventas hoy', value: formatNumber(data.kpi.salesTodayCount, 0), icon: 'receipt-outline' },
  ];

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <ScreenHeader
        title="Dashboard"
        subtitle={user?.company?.name}
        actions={
          <Button title="Actualizar" variant="secondary" size="sm" onPress={load} loading={loading} />
        }
      />

      {/* KPIs */}
      <View style={styles.grid}>
        {kpis.map((kpi) => (
          <View key={kpi.key} style={[styles.kpiSlot, { width: kpiWidth as `${number}%` }]}>
            <View style={[styles.kpi, { backgroundColor: c.card, borderColor: c.border }, theme.shadow]}>
              <View style={[styles.kpiIcon, { backgroundColor: c.primaryLight }]}>
                <Ionicons name={kpi.icon} size={18} color={c.primary} />
              </View>
              <Text style={[styles.kpiValue, { color: c.text }]} numberOfLines={1}>
                {kpi.value}
              </Text>
              <Text style={[styles.kpiLabel, { color: c.textMuted }]} numberOfLines={2}>
                {kpi.label}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Evolución de ventas */}
      <Card title="Ventas por día (periodo reciente)" style={styles.section}>
        {data.salesByPeriod.length === 0 ? (
          <Text style={[styles.muted, { color: c.textMuted }]}>
            Todavía no hay ventas registradas en el periodo.
          </Text>
        ) : (
          <View style={styles.chart}>
            {data.salesByPeriod.map((point) => {
              const max = Math.max(...data.salesByPeriod.map((p) => p.total), 1);
              const height = Math.max(4, Math.round((point.total / max) * 110));
              return (
                <View key={point.date} style={styles.barSlot}>
                  <Text style={[styles.barValue, { color: c.textMuted }]} numberOfLines={1}>
                    {formatCurrency(point.total)}
                  </Text>
                  <View style={[styles.bar, { height, backgroundColor: c.primary }]} />
                  <Text style={[styles.barLabel, { color: c.textMuted }]}>{point.date.slice(5)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      <View style={[styles.columns, isDesktop ? undefined : styles.columnsStacked]}>
        {/* Ventas recientes */}
        <Card title="Ventas recientes" style={styles.section}>
          {data.recentSales.length === 0 ? (
            <Text style={{ color: c.textMuted, fontSize: 14 }}>Sin ventas registradas.</Text>
          ) : (
            data.recentSales.map((sale) => {
              const badge = SALE_STATUS_BADGES[sale.status];
              const customer =
                sale.customerId && typeof sale.customerId === 'object' ? sale.customerId.name : '—';
              return (
                <View key={sale._id} style={[styles.listRow, { borderColor: c.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>{customer}</Text>
                    <Text style={{ color: c.textMuted, fontSize: 12 }}>{formatDateTime(sale.createdAt)}</Text>
                  </View>
                  <Badge label={badge.label} tone={badge.tone} />
                  <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>
                    {formatCurrency(sale.total)}
                  </Text>
                </View>
              );
            })
          )}
        </Card>

        {/* Compras recientes */}
        <Card title="Compras recientes" style={styles.section}>
          {data.recentPurchases.length === 0 ? (
            <Text style={{ color: c.textMuted, fontSize: 14 }}>Sin compras registradas.</Text>
          ) : (
            data.recentPurchases.map((purchase) => {
              const badge = PURCHASE_STATUS_BADGES[purchase.status];
              const supplier =
                purchase.supplierId && typeof purchase.supplierId === 'object'
                  ? purchase.supplierId.name
                  : '—';
              return (
                <View key={purchase._id} style={[styles.listRow, { borderColor: c.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>{supplier}</Text>
                    <Text style={{ color: c.textMuted, fontSize: 12 }}>{formatDateTime(purchase.createdAt)}</Text>
                  </View>
                  <Badge label={badge.label} tone={badge.tone} />
                  <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>
                    {formatCurrency(purchase.total)}
                  </Text>
                </View>
              );
            })
          )}
        </Card>
      </View>

      <View style={[styles.columns, isDesktop ? undefined : styles.columnsStacked]}>
        {/* Stock mínimo */}
        <Card title="Productos bajo stock mínimo" style={styles.section}>
          {data.lowStock.length === 0 ? (
            <Text style={{ color: c.textMuted, fontSize: 14 }}>
              Ningún producto por debajo del mínimo.
            </Text>
          ) : (
            data.lowStock.map((item) => (
              <View key={`${item.sku}-${item.name}`} style={[styles.listRow, { borderColor: c.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>{item.name}</Text>
                  <Text style={{ color: c.textMuted, fontSize: 12 }}>SKU {item.sku}</Text>
                </View>
                <Badge label={`${formatNumber(item.totalStock, 0)} / ${formatNumber(item.stockMin, 0)} ${item.unit ?? ''}`} tone="danger" />
              </View>
            ))
          )}
        </Card>

        {/* Top productos */}
        <Card title="Productos más vendidos" style={styles.section}>
          {data.topProducts.length === 0 ? (
            <Text style={{ color: c.textMuted, fontSize: 14 }}>Sin ventas suficientes todavía.</Text>
          ) : (
            data.topProducts.map((product, index) => (
              <View key={product.productId} style={[styles.listRow, { borderColor: c.border }]}>
                <Text style={{ color: c.primary, fontWeight: '800', fontSize: 14, width: 24 }}>
                  {index + 1}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>{product.name}</Text>
                  <Text style={{ color: c.textMuted, fontSize: 12 }}>
                    {formatNumber(product.quantity, 0)} uds.
                  </Text>
                </View>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>
                  {formatCurrency(product.revenue)}
                </Text>
              </View>
            ))
          )}
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  kpiSlot: { flexGrow: 1 },
  kpi: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 6 },
  kpiIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 20, fontWeight: '800' },
  kpiLabel: { fontSize: 12, fontWeight: '600' },
  section: { marginTop: 16 },
  columns: { flexDirection: 'row', gap: 14 },
  columnsStacked: { flexDirection: 'column' },
  muted: { fontSize: 14 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, minHeight: 150, paddingTop: 8 },
  barSlot: { flex: 1, alignItems: 'center', gap: 4 },
  barValue: { fontSize: 10 },
  bar: { width: '70%', borderRadius: 6 },
  barLabel: { fontSize: 11 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
