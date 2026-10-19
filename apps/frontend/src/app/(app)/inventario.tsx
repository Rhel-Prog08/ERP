import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { inventoryService } from '../../services/inventoryService';
import { productsService } from '../../services/productsService';
import { warehousesService } from '../../services/warehousesService';
import { PERMISSIONS } from '../../constants/permissions';
import { MOVEMENT_BADGES, MOVEMENT_OPTIONS } from '../../constants/statuses';
import type { QueryParams } from '../../types/api';
import type {
  Balance,
  Movement,
  MovementInput,
  MovementType,
  Product,
  Warehouse,
} from '../../types/models';
import { formatDateTime, formatNumber } from '../../utils/format';
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

type Tab = 'existencias' | 'movimientos';

interface MovementForm {
  productId: string;
  warehouseId: string;
  type: MovementType;
  quantity: string;
  reason: string;
}

const EMPTY_FORM: MovementForm = {
  productId: '',
  warehouseId: '',
  type: 'ENTRY',
  quantity: '',
  reason: '',
};

/** Permiso exigido por cada tipo en POST /inventory/movements. */
const TYPE_PERMISSION: Record<MovementType, string> = {
  ENTRY: PERMISSIONS.INVENTORY_ENTRY,
  RETURN: PERMISSIONS.INVENTORY_ENTRY,
  EXIT: PERMISSIONS.INVENTORY_EXIT,
  ADJUSTMENT: PERMISSIONS.INVENTORY_ADJUST,
};

/**
 * Inventario: existencias por almacén (GET /inventory) y historial de
 * movimientos (GET /inventory/movements) + alta de movimientos manuales.
 */
export default function InventarioScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const toast = useToast();
  const { can } = useAuth();

  const [tab, setTab] = useState<Tab>('existencias');

  /* --------------------------- datos auxiliares --------------------------- */
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(true);

  const loadWarehouses = useCallback(() => {
    warehousesService
      .list({ limit: 100 })
      .then((result) => setWarehouses(result.items))
      .catch((err) => toast.error(toApiError(err).message))
      .finally(() => setWarehousesLoading(false));
  }, [toast]);

  // Carga inicial (el estado de carga ya arranca en true; los cambios de
  // estado sólo ocurren en los callbacks asíncronos).
  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  /* -------------------------------- listas -------------------------------- */
  const [warehouseFilter, setWarehouseFilter] = useState<string | null>(null);
  const fetchBalances = useCallback(
    (params: QueryParams) => inventoryService.listBalances(params),
    []
  );
  const balances = usePaginatedList<Balance>(fetchBalances, {
    filters: { warehouseId: warehouseFilter ?? undefined },
  });

  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const fetchMovements = useCallback(
    (params: QueryParams) => inventoryService.listMovements(params),
    []
  );
  const movements = usePaginatedList<Movement>(fetchMovements, {
    filters: { type: typeFilter ?? undefined },
  });

  /* ------------------------- formulario de movimiento ------------------------- */
  const allowedTypeOptions = MOVEMENT_OPTIONS.filter((o) => can(TYPE_PERMISSION[o.value]));
  const canCreate = allowedTypeOptions.length > 0;

  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<MovementForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const productsRequested = useRef(false);

  // Los productos se cargan sólo la primera vez que se abre el formulario.
  useEffect(() => {
    if (!formVisible || productsRequested.current) return;
    productsRequested.current = true;
    setProductsLoading(true);
    productsService
      .list({ limit: 100 })
      .then((result) => setProducts(result.items))
      .catch((err) => {
        // Si falla se permite reintentar al volver a abrir el formulario.
        productsRequested.current = false;
        toast.error(toApiError(err).message);
      })
      .finally(() => setProductsLoading(false));
  }, [formVisible, toast]);

  const openCreate = () => {
    setFieldErrors({});
    setForm({ ...EMPTY_FORM, type: allowedTypeOptions[0]?.value ?? 'ENTRY' });
    setFormVisible(true);
  };

  const save = async () => {
    setFieldErrors({});
    const errors: Record<string, string | undefined> = {};
    if (!form.productId) errors.productId = 'Selecciona un producto';
    if (!form.warehouseId) errors.warehouseId = 'Selecciona un almacén';
    if (!can(TYPE_PERMISSION[form.type])) {
      errors.type = 'No tienes permiso para registrar este tipo de movimiento';
    }
    const quantity = Number(form.quantity.replace(',', '.'));
    if (!form.quantity.trim() || !Number.isFinite(quantity) || quantity <= 0) {
      errors.quantity = 'La cantidad debe ser un número mayor que 0';
    }
    if (Object.values(errors).some(Boolean)) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const reason = form.reason.trim();
      const payload: MovementInput = {
        productId: form.productId,
        warehouseId: form.warehouseId,
        type: form.type,
        quantity,
        ...(reason ? { reason } : {}),
      };
      await inventoryService.createMovement(payload);
      toast.success('Movimiento registrado');
      setFormVisible(false);
      movements.reload();
      balances.reload();
    } catch (err) {
      const apiError = toApiError(err);
      setFieldErrors({
        productId: apiError.fieldError('productId'),
        warehouseId: apiError.fieldError('warehouseId'),
        type: apiError.fieldError('type'),
        quantity: apiError.fieldError('quantity'),
        reason: apiError.fieldError('reason'),
      });
      if (!apiError.details?.length) toast.error(apiError.message);
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------- columnas ------------------------------- */
  const cell = (text: string) => (
    <Text style={{ color: c.text, fontSize: 14 }} numberOfLines={2}>
      {text}
    </Text>
  );

  const numStyle = { color: c.text, fontSize: 14, fontWeight: '600' as const };

  const balanceColumns: TableColumn<Balance>[] = [
    { key: 'product.name', label: 'Producto' },
    { key: 'product.sku', label: 'SKU', width: 130 },
    { key: 'warehouse.name', label: 'Almacén', width: 150 },
    {
      key: 'quantity',
      label: 'Cantidad',
      width: 100,
      align: 'right',
      render: (row) => <Text style={numStyle}>{formatNumber(row.quantity)}</Text>,
    },
    {
      key: 'stockMin',
      label: 'Stock mínimo',
      width: 120,
      align: 'right',
      render: (row) => <Text style={numStyle}>{formatNumber(row.product.stockMin)}</Text>,
    },
    {
      key: 'status',
      label: 'Estado',
      width: 130,
      render: (row) => {
        const min = row.product.stockMin;
        if (min === undefined || min === null) {
          return <Badge label="Sin mínimo" tone="neutral" />;
        }
        return row.quantity < min ? (
          <Badge label="Stock bajo" tone="danger" />
        ) : (
          <Badge label="Stock correcto" tone="success" />
        );
      },
    },
  ];

  const movementColumns: TableColumn<Movement>[] = [
    {
      key: 'createdAt',
      label: 'Fecha',
      width: 150,
      render: (row) => cell(formatDateTime(row.createdAt)),
    },
    {
      key: 'product',
      label: 'Producto',
      render: (row) =>
        cell(typeof row.productId === 'object' ? (row.productId.name ?? '—') : '—'),
    },
    {
      key: 'type',
      label: 'Tipo',
      width: 120,
      render: (row) => <Badge label={MOVEMENT_BADGES[row.type].label} tone={MOVEMENT_BADGES[row.type].tone} />,
    },
    {
      key: 'quantity',
      label: 'Cantidad',
      width: 100,
      align: 'right',
      render: (row) => <Text style={numStyle}>{formatNumber(row.quantity)}</Text>,
    },
    {
      key: 'user',
      label: 'Usuario',
      width: 170,
      render: (row) => {
        const user = row.userId;
        if (!user || typeof user === 'string') return cell('—');
        const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
        return cell(name || '—');
      },
    },
    {
      key: 'reason',
      label: 'Motivo / referencia',
      render: (row) =>
        cell(
          row.reason?.trim() ||
            (row.referenceType ? `Referencia: ${row.referenceType}` : '—')
        ),
    },
  ];

  /* --------------------------------- UI ---------------------------------- */
  const subtitle =
    tab === 'existencias'
      ? `${balances.total} ${balances.total === 1 ? 'existencia' : 'existencias'}`
      : `${movements.total} ${movements.total === 1 ? 'movimiento' : 'movimientos'}`;

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <ScreenHeader
        title="Inventario"
        subtitle={subtitle}
        actions={
          <>
            <Button
              title="Existencias"
              variant={tab === 'existencias' ? 'primary' : 'ghost'}
              onPress={() => setTab('existencias')}
            />
            <Button
              title="Movimientos"
              variant={tab === 'movimientos' ? 'primary' : 'ghost'}
              onPress={() => setTab('movimientos')}
            />
            {canCreate && tab === 'movimientos' ? (
              <Button title="Nuevo movimiento" onPress={openCreate} />
            ) : null}
          </>
        }
      />

      {/* ----------------------------- Existencias ----------------------------- */}
      <View style={tab === 'existencias' ? undefined : styles.hidden}>
        <Card>
          <View style={styles.toolbar}>
            <SearchInput
              value={balances.search}
              onChange={balances.setSearch}
              placeholder="Buscar por nombre o SKU…"
            />
            <View style={{ width: 190 }}>
              <Select
                label="Almacén"
                value={warehouseFilter}
                options={[
                  { value: '', label: 'Todos' },
                  ...warehouses.map((w) => ({ value: w._id, label: w.name })),
                ]}
                onChange={(value) => setWarehouseFilter(value || null)}
                placeholder={warehousesLoading ? 'Cargando…' : 'Todos'}
                disabled={warehousesLoading}
              />
            </View>
          </View>

          {balances.loading && balances.items.length === 0 ? (
            <LoadingState message="Cargando existencias…" />
          ) : balances.error ? (
            <ErrorState message={balances.error} onRetry={balances.reload} />
          ) : balances.items.length === 0 ? (
            <EmptyState
              title="Sin existencias"
              message={
                balances.search || warehouseFilter
                  ? 'Ningún producto coincide con los filtros.'
                  : 'Todavía no hay existencias registradas en ningún almacén.'
              }
            />
          ) : (
            <>
              <DataTable columns={balanceColumns} rows={balances.items} rowKey={(row) => row._id} />
              <Pagination
                page={balances.page}
                totalPages={balances.totalPages}
                total={balances.total}
                onPageChange={balances.setPage}
                loading={balances.loading}
              />
            </>
          )}
        </Card>
      </View>

      {/* ----------------------------- Movimientos ----------------------------- */}
      <View style={tab === 'movimientos' ? undefined : styles.hidden}>
        <Card>
          <View style={styles.toolbar}>
            <View style={{ width: 210 }}>
              <Select
                label="Tipo"
                value={typeFilter}
                options={[
                  { value: '', label: 'Todos' },
                  ...MOVEMENT_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
                ]}
                onChange={(value) => setTypeFilter(value || null)}
                placeholder="Todos"
              />
            </View>
          </View>

          {movements.loading && movements.items.length === 0 ? (
            <LoadingState message="Cargando movimientos…" />
          ) : movements.error ? (
            <ErrorState message={movements.error} onRetry={movements.reload} />
          ) : movements.items.length === 0 ? (
            <EmptyState
              title="Sin movimientos"
              message={
                typeFilter
                  ? 'Ningún movimiento coincide con el filtro de tipo.'
                  : 'Todavía no hay movimientos de inventario registrados.'
              }
            />
          ) : (
            <>
              <DataTable
                columns={movementColumns}
                rows={movements.items}
                rowKey={(row) => row._id}
              />
              <Pagination
                page={movements.page}
                totalPages={movements.totalPages}
                total={movements.total}
                onPageChange={movements.setPage}
                loading={movements.loading}
              />
            </>
          )}
        </Card>
      </View>

      {/* --------------------------- Nuevo movimiento --------------------------- */}
      <Modal visible={formVisible} transparent animationType="fade" onRequestClose={() => setFormVisible(false)}>
        <Pressable style={[styles.backdrop, { backgroundColor: c.overlay }]} onPress={() => setFormVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.formWrap}>
            <Pressable style={[styles.form, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.formTitle, { color: c.text }]}>Nuevo movimiento de inventario</Text>

              <Select
                label="Tipo *"
                value={form.type}
                options={allowedTypeOptions.map((o) => ({ value: o.value, label: o.label }))}
                onChange={(value) => setForm((f) => ({ ...f, type: value as MovementType }))}
                error={fieldErrors.type}
                disabled={saving}
              />
              <Select
                label="Producto *"
                value={form.productId || null}
                options={products.map((p) => ({ value: p._id, label: `${p.name} (${p.sku})` }))}
                onChange={(value) => setForm((f) => ({ ...f, productId: value }))}
                placeholder={productsLoading ? 'Cargando productos…' : 'Selecciona un producto'}
                error={fieldErrors.productId}
                disabled={saving || productsLoading}
              />
              <Select
                label="Almacén *"
                value={form.warehouseId || null}
                options={warehouses.map((w) => ({ value: w._id, label: w.name }))}
                onChange={(value) => setForm((f) => ({ ...f, warehouseId: value }))}
                placeholder={warehousesLoading ? 'Cargando almacenes…' : 'Selecciona un almacén'}
                error={fieldErrors.warehouseId}
                disabled={saving || warehousesLoading}
              />
              <Input
                label="Cantidad *"
                value={form.quantity}
                onChangeText={(v) => setForm((f) => ({ ...f, quantity: v }))}
                error={fieldErrors.quantity}
                keyboardType="numeric"
                placeholder="0"
                editable={!saving}
              />
              <Input
                label="Motivo"
                value={form.reason}
                onChangeText={(v) => setForm((f) => ({ ...f, reason: v }))}
                error={fieldErrors.reason}
                placeholder="Motivo o referencia (opcional)"
                maxLength={200}
                editable={!saving}
              />

              <View style={styles.formActions}>
                <Button title="Cancelar" variant="ghost" onPress={() => setFormVisible(false)} disabled={saving} />
                <Button title="Registrar movimiento" onPress={() => void save()} loading={saving} />
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
  hidden: { display: 'none' },
  toolbar: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 },
  backdrop: { flex: 1, justifyContent: 'center', padding: 16 },
  formWrap: { width: '100%', alignItems: 'center' },
  form: {
    width: '100%',
    maxWidth: 560,
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
    gap: 14,
  },
  formTitle: { fontSize: 18, fontWeight: '800' },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
});
