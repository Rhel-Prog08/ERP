import React, { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { toApiError } from '../../services/apiClient';
import { purchasesService } from '../../services/purchasesService';
import { suppliersService } from '../../services/suppliersService';
import { warehousesService } from '../../services/warehousesService';
import { productsService } from '../../services/productsService';
import { settingsService } from '../../services/settingsService';
import type {
  DocumentCreateInput,
  DocumentInputItem,
  Product,
  Purchase,
  Supplier,
  Warehouse,
} from '../../types/models';
import { PURCHASE_STATUS_BADGES, PURCHASE_STATUS_OPTIONS } from '../../constants/statuses';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { DataTable, type TableColumn } from '../../components/ui/DataTable';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { SearchInput } from '../../components/ui/SearchInput';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatPercent,
} from '../../utils/format';

/** Línea del constructor de artículos (estado local del formulario). */
interface PurchaseLineDraft {
  _key: string;
  productId: string;
  quantity: string;
  unitPrice: string;
}

function parseNumber(value: string): number | null {
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Compras: listado paginado (GET /purchases) con filtros por estado y búsqueda,
 * creación de borradores (POST /purchases) y flujo de estado
 * DRAFT → CONFIRMED → RECEIVED / CANCELLED (confirm/receive/cancel).
 * El precio unitario se precarga con `purchasePrice` del producto.
 */
export default function ComprasScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const toast = useToast();
  const { can } = useAuth();

  /* ------------------------------ Listado ------------------------------ */
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const list = usePaginatedList<Purchase>((params) => purchasesService.list(params), {
    filters: { status: statusFilter ?? undefined },
  });

  /* --------------------- Acciones de estado (fila) --------------------- */
  const [busyId, setBusyId] = useState<string | null>(null);

  const runAction = async (
    row: Purchase,
    action: 'confirm' | 'receive',
    message: string
  ) => {
    setBusyId(row._id);
    try {
      if (action === 'confirm') await purchasesService.confirm(row._id);
      else await purchasesService.receive(row._id);
      toast.success(message);
      list.reload();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  /* --------------------------- Cancelar compra --------------------------- */
  const [toCancel, setToCancel] = useState<Purchase | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | undefined>(undefined);
  const [cancelling, setCancelling] = useState(false);

  const openCancel = (row: Purchase) => {
    setToCancel(row);
    setCancelReason('');
    setCancelError(undefined);
  };

  const doCancel = async () => {
    if (!toCancel) return;
    const reason = cancelReason.trim();
    if (reason.length < 3) {
      setCancelError('El motivo debe tener al menos 3 caracteres');
      return;
    }
    setCancelling(true);
    try {
      await purchasesService.cancel(toCancel._id, reason);
      toast.success('Compra cancelada');
      setToCancel(null);
      list.reload();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setCancelling(false);
    }
  };

  /* --------------------------- Formulario nueva --------------------------- */
  const [formVisible, setFormVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  /** tasa de IVA (0.21) o null si no está disponible. */
  const [taxRate, setTaxRate] = useState<number | null>(null);
  const [taxError, setTaxError] = useState(false);

  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [lines, setLines] = useState<PurchaseLineDraft[]>([]);

  const lineKeyRef = useRef(0);
  const nextLineKey = () => {
    lineKeyRef.current += 1;
    return String(lineKeyRef.current);
  };
  const optionsLoadedRef = useRef(false);

  const loadOptions = async () => {
    setOptionsLoading(true);
    const [sup, wh, prod, settings] = await Promise.allSettled([
      suppliersService.list({ limit: 100, status: 'active' }),
      warehousesService.list({ limit: 100 }),
      productsService.list({ limit: 100 }),
      settingsService.get(),
    ]);
    const failed: string[] = [];
    if (sup.status === 'fulfilled') setSuppliers(sup.value.items);
    else failed.push('proveedores');
    if (wh.status === 'fulfilled') setWarehouses(wh.value.items);
    else failed.push('almacenes');
    if (prod.status === 'fulfilled') setProducts(prod.value.items);
    else failed.push('productos');
    if (settings.status === 'fulfilled') {
      setTaxRate(settings.value.taxRate);
      setTaxError(false);
    } else {
      setTaxRate(null);
      setTaxError(true);
    }
    if (failed.length > 0) toast.error(`No se pudieron cargar: ${failed.join(', ')}`);
    setOptionsLoading(false);
  };

  const openCreate = () => {
    if (!optionsLoadedRef.current) {
      optionsLoadedRef.current = true;
      void loadOptions();
    }
    setSupplierId('');
    setWarehouseId('');
    setLines([{ _key: nextLineKey(), productId: '', quantity: '1', unitPrice: '' }]);
    setFieldErrors({});
    setFormVisible(true);
  };

  const addLine = () =>
    setLines((ls) => [...ls, { _key: nextLineKey(), productId: '', quantity: '1', unitPrice: '' }]);

  const removeLine = (key: string) => setLines((ls) => ls.filter((l) => l._key !== key));

  const onProductChange = (key: string, productId: string) => {
    const product = products.find((p) => p._id === productId);
    setLines((ls) =>
      ls.map((l) =>
        l._key === key
          ? { ...l, productId, unitPrice: product ? String(product.purchasePrice) : '' }
          : l
      )
    );
  };

  /** Previsualización de totales en cliente (el backend los recalcula). */
  const totals = useMemo(() => {
    let subtotal = 0;
    for (const line of lines) {
      const qty = parseNumber(line.quantity);
      const price = parseNumber(line.unitPrice);
      if (qty !== null && qty > 0 && price !== null && price >= 0) subtotal += qty * price;
    }
    const tax = subtotal * (taxRate ?? 0);
    return { subtotal, tax, total: subtotal + tax };
  }, [lines, taxRate]);

  const save = async () => {
    const errs: Record<string, string | undefined> = {};
    if (!supplierId) errs.supplierId = 'Selecciona un proveedor';
    if (!warehouseId) errs.warehouseId = 'Selecciona un almacén';
    if (lines.length === 0) errs.lines = 'Añade al menos una línea';

    const items: DocumentInputItem[] = [];
    lines.forEach((line, index) => {
      const qty = parseNumber(line.quantity);
      const price = parseNumber(line.unitPrice);
      if (!line.productId) {
        errs[`line_${line._key}_productId`] = `Línea ${index + 1}: selecciona un producto`;
      }
      if (qty === null || qty <= 0) {
        errs[`line_${line._key}_quantity`] = `Línea ${index + 1}: la cantidad debe ser mayor que 0`;
      }
      if (price === null || price < 0) {
        errs[`line_${line._key}_unitPrice`] = `Línea ${index + 1}: precio no válido`;
      }
      if (line.productId && qty !== null && qty > 0 && price !== null && price >= 0) {
        items.push({ productId: line.productId, quantity: qty, unitPrice: price });
      }
    });

    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const payload: DocumentCreateInput = { supplierId, warehouseId, items };
      const created = await purchasesService.create(payload);
      toast.success(
        `Compra creada como borrador · subtotal ${formatCurrency(created.subtotal)} · IVA ${formatCurrency(created.tax)} · total ${formatCurrency(created.total)}`
      );
      setFormVisible(false);
      list.reload();
    } catch (err) {
      const apiError = toApiError(err);
      setFieldErrors({
        supplierId: apiError.fieldError('supplierId'),
        warehouseId: apiError.fieldError('warehouseId'),
        lines: apiError.fieldError('items'),
      });
      if (!apiError.details?.length) toast.error(apiError.message);
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------- Tabla -------------------------------- */
  const columns: TableColumn<Purchase>[] = [
    {
      key: 'createdAt',
      label: 'Fecha',
      width: 150,
      render: (row) => formatDateTime(row.createdAt),
    },
    {
      key: 'supplierId',
      label: 'Proveedor',
      render: (row) => {
        const ref = typeof row.supplierId === 'object' && row.supplierId !== null ? row.supplierId : null;
        return <Text style={styles.cellText}>{ref?.name ?? '—'}</Text>;
      },
    },
    {
      key: 'items',
      label: 'N.º artículos',
      width: 110,
      render: (row) => (
        <Text style={styles.cellText}>{formatNumber(row.items?.length ?? 0, 0)}</Text>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      width: 130,
      align: 'right',
      render: (row) => <Text style={styles.cellStrong}>{formatCurrency(row.total)}</Text>,
    },
    {
      key: 'status',
      label: 'Estado',
      width: 120,
      render: (row) => {
        const info = PURCHASE_STATUS_BADGES[row.status];
        return <Badge label={info.label} tone={info.tone} />;
      },
    },
    {
      key: '_actions',
      label: 'Acciones',
      width: 250,
      render: (row) => (
        <View style={styles.rowActions}>
          {can('purchases.update') && row.status === 'DRAFT' ? (
            <Button
              title="Confirmar"
              variant="secondary"
              size="sm"
              loading={busyId === row._id}
              onPress={() => void runAction(row, 'confirm', 'Compra confirmada')}
            />
          ) : null}
          {can('purchases.update') && row.status === 'CONFIRMED' ? (
            <Button
              title="Recibir"
              size="sm"
              loading={busyId === row._id}
              onPress={() => void runAction(row, 'receive', 'Compra recibida (inventario actualizado)')}
            />
          ) : null}
          {can('purchases.cancel') && (row.status === 'DRAFT' || row.status === 'CONFIRMED') ? (
            <Button title="Cancelar" variant="ghost" size="sm" onPress={() => openCancel(row)} />
          ) : null}
        </View>
      ),
    },
  ];

  const productOptions = products.map((p) => ({ value: p._id, label: `${p.name} (${p.sku})` }));

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <ScreenHeader
        title="Compras"
        subtitle={`${list.total} ${list.total === 1 ? 'compra registrada' : 'compras registradas'}`}
        actions={
          can('purchases.create') ? <Button title="Nueva compra" onPress={openCreate} /> : undefined
        }
      />

      <Card>
        <View style={styles.toolbar}>
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Buscar compras…" />
          <View style={{ width: 190 }}>
            <Select
              label="Estado"
              value={statusFilter}
              options={[
                { value: '', label: 'Todas' },
                ...PURCHASE_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
              ]}
              onChange={(value) => setStatusFilter(value || null)}
              placeholder="Todas"
            />
          </View>
        </View>

        {list.loading && list.items.length === 0 ? (
          <LoadingState message="Cargando compras…" />
        ) : list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : list.items.length === 0 ? (
          <EmptyState
            title="Sin compras"
            message={
              list.search || statusFilter
                ? 'Ninguna compra coincide con los filtros.'
                : 'Todavía no hay compras registradas.'
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

      {/* Formulario nueva compra (sólo borradores) */}
      <Modal visible={formVisible} transparent animationType="fade" onRequestClose={() => setFormVisible(false)}>
        <Pressable style={[styles.backdrop, { backgroundColor: c.overlay }]} onPress={() => setFormVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.formWrap}>
            <Pressable style={[styles.form, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.formTitle, { color: c.text }]}>Nueva compra (borrador)</Text>

              <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
                <View style={styles.formFields}>
                  <Select
                    label="Proveedor *"
                    value={supplierId || null}
                    options={suppliers.map((s) => ({
                      value: s._id,
                      label: s.companyName ? `${s.name} · ${s.companyName}` : s.name,
                    }))}
                    onChange={setSupplierId}
                    placeholder={optionsLoading ? 'Cargando proveedores…' : 'Selecciona un proveedor'}
                    error={fieldErrors.supplierId}
                    disabled={saving || optionsLoading}
                  />
                  <Select
                    label="Almacén *"
                    value={warehouseId || null}
                    options={warehouses.map((w) => ({ value: w._id, label: w.name }))}
                    onChange={setWarehouseId}
                    placeholder={optionsLoading ? 'Cargando almacenes…' : 'Selecciona un almacén'}
                    error={fieldErrors.warehouseId}
                    disabled={saving || optionsLoading}
                  />

                  <Text style={[styles.sectionLabel, { color: c.text }]}>Líneas *</Text>
                  {fieldErrors.lines ? (
                    <Text style={[styles.lineError, { color: c.danger }]}>{fieldErrors.lines}</Text>
                  ) : null}

                  {lines.length === 0 ? (
                    <Text style={{ color: c.textMuted, fontSize: 13 }}>
                      Sin líneas. Pulsa «Añadir línea» para empezar.
                    </Text>
                  ) : null}

                  {lines.map((line, index) => {
                    const qty = parseNumber(line.quantity);
                    const price = parseNumber(line.unitPrice);
                    const lineSubtotal = qty !== null && qty > 0 && price !== null && price >= 0
                      ? qty * price
                      : null;
                    return (
                      <View
                        key={line._key}
                        style={[styles.line, { borderColor: c.border, backgroundColor: c.bg }]}
                      >
                        <View style={styles.lineRow}>
                          <Select
                            label={`Producto ${index + 1} *`}
                            value={line.productId || null}
                            options={productOptions}
                            onChange={(value) => onProductChange(line._key, value)}
                            placeholder={optionsLoading ? 'Cargando…' : 'Selecciona un producto'}
                            error={fieldErrors[`line_${line._key}_productId`]}
                            disabled={saving || optionsLoading}
                            containerStyle={styles.lineProduct}
                          />
                          <Pressable
                            onPress={() => removeLine(line._key)}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={`Quitar línea ${index + 1}`}
                            style={styles.removeLine}
                          >
                            <Text style={{ fontSize: 16, color: c.danger, fontWeight: '700' }}>✕</Text>
                          </Pressable>
                        </View>
                        <View style={styles.lineRow}>
                          <Input
                            label="Cantidad *"
                            value={line.quantity}
                            onChangeText={(v) =>
                              setLines((ls) =>
                                ls.map((l) => (l._key === line._key ? { ...l, quantity: v } : l))
                              )
                            }
                            keyboardType="decimal-pad"
                            error={fieldErrors[`line_${line._key}_quantity`]}
                            editable={!saving}
                            containerStyle={styles.lineQty}
                          />
                          <Input
                            label="Precio unit. *"
                            value={line.unitPrice}
                            onChangeText={(v) =>
                              setLines((ls) =>
                                ls.map((l) => (l._key === line._key ? { ...l, unitPrice: v } : l))
                              )
                            }
                            keyboardType="decimal-pad"
                            error={fieldErrors[`line_${line._key}_unitPrice`]}
                            editable={!saving}
                            containerStyle={styles.linePrice}
                          />
                          <View style={styles.lineSubtotal}>
                            <Text style={[styles.lineSubtotalLabel, { color: c.textMuted }]}>Subtotal</Text>
                            <Text style={[styles.cellStrong, { color: c.text }]}>
                              {lineSubtotal !== null ? formatCurrency(lineSubtotal) : '—'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}

                  <Button title="Añadir línea" variant="secondary" size="sm" onPress={addLine} disabled={saving} />

                  <View style={[styles.totals, { borderTopColor: c.border }]}>
                    <View style={styles.totalRow}>
                      <Text style={{ color: c.textMuted }}>Subtotal</Text>
                      <Text style={[styles.cellStrong, { color: c.text }]}>{formatCurrency(totals.subtotal)}</Text>
                    </View>
                    <View style={styles.totalRow}>
                      <Text style={{ color: c.textMuted }}>
                        {taxRate !== null ? `IVA (${formatPercent(taxRate)})` : 'IVA'}
                      </Text>
                      {taxRate !== null ? (
                        <Text style={[styles.cellStrong, { color: c.text }]}>{formatCurrency(totals.tax)}</Text>
                      ) : (
                        <Text style={{ color: c.textMuted, fontSize: 13 }}>
                          {taxError ? 'IVA no disponible' : 'Calculando…'}
                        </Text>
                      )}
                    </View>
                    <View style={styles.totalRow}>
                      <Text style={{ color: c.text, fontWeight: '700' }}>Total</Text>
                      <Text style={[styles.totalGrand, { color: c.primary }]}>
                        {formatCurrency(totals.total)}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: c.textLight, fontSize: 12 }}>
                    Los impuestos y el total finales los calcula el servidor al crear la compra.
                  </Text>
                </View>
              </ScrollView>

              <View style={styles.formActions}>
                <Button title="Cancelar" variant="ghost" onPress={() => setFormVisible(false)} disabled={saving} />
                <Button title="Crear compra" onPress={() => void save()} loading={saving} />
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Cancelación con motivo obligatorio */}
      <Modal visible={toCancel !== null} transparent animationType="fade" onRequestClose={() => setToCancel(null)}>
        <Pressable style={[styles.backdrop, { backgroundColor: c.overlay }]} onPress={() => setToCancel(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.formWrap}>
            <Pressable style={[styles.dialog, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.formTitle, { color: c.text }]}>Cancelar compra</Text>
              <Text style={{ color: c.textMuted, fontSize: 14, lineHeight: 20 }}>
                Se cancelará la compra{toCancel?.status === 'CONFIRMED' ? ' y se revertirá el inventario recibido' : ''}. Esta acción no se puede deshacer.
              </Text>
              <Input
                label="Motivo de la cancelación *"
                value={cancelReason}
                onChangeText={(v) => {
                  setCancelReason(v);
                  setCancelError(undefined);
                }}
                error={cancelError}
                placeholder="Ej.: error en el pedido"
                hint="Mínimo 3 caracteres, máx. 200."
                multiline
                maxLength={200}
                editable={!cancelling}
              />
              <View style={styles.formActions}>
                <Button title="Volver" variant="ghost" onPress={() => setToCancel(null)} disabled={cancelling} />
                <Button title="Cancelar compra" variant="danger" loading={cancelling} onPress={() => void doCancel()} />
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 40 },
  toolbar: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 },
  rowActions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  cellText: { fontSize: 14 },
  cellStrong: { fontSize: 14, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'center', padding: 16 },
  formWrap: { width: '100%', alignItems: 'center' },
  form: {
    width: '100%',
    maxWidth: 640,
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
    gap: 14,
    maxHeight: '92%',
  },
  dialog: {
    width: '100%',
    maxWidth: 460,
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
    gap: 12,
  },
  formTitle: { fontSize: 18, fontWeight: '800' },
  formScroll: { flexGrow: 0, maxHeight: 460 },
  formFields: { gap: 12 },
  sectionLabel: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  lineError: { fontSize: 12, fontWeight: '500' },
  line: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  lineRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' },
  lineProduct: { flexGrow: 1, minWidth: 200 },
  lineQty: { width: 96 },
  linePrice: { width: 120 },
  lineSubtotal: { flexGrow: 1, minWidth: 100, alignItems: 'flex-end', paddingBottom: 6 },
  lineSubtotalLabel: { fontSize: 12, fontWeight: '600' },
  removeLine: { paddingBottom: 10, paddingHorizontal: 4 },
  totals: { borderTopWidth: 1, paddingTop: 10, gap: 6, marginTop: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalGrand: { fontSize: 17, fontWeight: '800' },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
});
