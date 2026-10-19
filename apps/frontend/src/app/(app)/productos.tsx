import React, { useCallback, useEffect, useState } from 'react';
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
import { productsService, type ProductInput } from '../../services/productsService';
import { categoriesService, type CategoryInput } from '../../services/categoriesService';
import { suppliersService } from '../../services/suppliersService';
import type { Category, Product, Status, Supplier, Unit } from '../../types/models';
import type { Paginated, QueryParams } from '../../types/api';
import { STATUS_BADGES, STATUS_OPTIONS, UNIT_OPTIONS } from '../../constants/statuses';
import { formatCurrency, formatNumber } from '../../utils/format';
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
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';

type TabKey = 'productos' | 'categorias';

/** Estado del formulario de producto (los números viajan como texto hasta enviar). */
interface ProductFormState {
  sku: string;
  name: string;
  description: string;
  categoryId: string;
  supplierId: string; // '' = sin proveedor
  purchasePrice: string;
  salePrice: string;
  stockMin: string;
  unit: Unit;
  status: Status;
}

interface CategoryFormState {
  name: string;
  description: string;
  status: Status;
}

const EMPTY_PRODUCT_FORM: ProductFormState = {
  sku: '',
  name: '',
  description: '',
  categoryId: '',
  supplierId: '',
  purchasePrice: '',
  salePrice: '',
  stockMin: '',
  unit: 'unidad',
  status: 'active',
};

const EMPTY_CATEGORY_FORM: CategoryFormState = { name: '', description: '', status: 'active' };

/**
 * Fetchers con identidad estable: usePaginatedList depende de la referencia del
 * fetcher, así sólo se piden datos cuando cambian página, búsqueda o filtros.
 */
const fetchProducts = (params: QueryParams): Promise<Paginated<Product>> => productsService.list(params);
const fetchCategories = (params: QueryParams): Promise<Paginated<Category>> => categoriesService.list(params);

/** Convierte el texto de un input numérico a número (admite coma decimal es-ES). */
function parseNumeric(raw: string): number {
  return Number(raw.trim().replace(',', '.'));
}

/**
 * categoryId puede viajar como id suelto o como categoría poblada
 * ({ _id, name }) según el endpoint; se normaliza siempre a string.
 */
function categoryIdOf(value: Product['categoryId']): string {
  const raw = value as unknown;
  if (raw !== null && typeof raw === 'object') return String((raw as { _id?: string })._id ?? '');
  return typeof raw === 'string' ? raw : '';
}

/** Nombre legible de la categoría de un producto (poblada o por catálogo local). */
function categoryNameOf(value: Product['categoryId'], catalog: Category[]): string {
  const raw = value as unknown;
  if (raw !== null && typeof raw === 'object') {
    const name = (raw as { name?: string }).name;
    if (name) return name;
  }
  const id = categoryIdOf(value);
  if (!id) return '—';
  return catalog.find((category) => category._id === id)?.name ?? '—';
}

function unitLabel(unit?: Unit): string {
  return UNIT_OPTIONS.find((option) => option.value === unit)?.label ?? '—';
}

/** Productos y categorías: /api/v1/products y /api/v1/categories en dos secciones. */
export default function ProductosScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const toast = useToast();
  const { can } = useAuth();

  /* ------------------------------- PESTAÑAS -------------------------------- */
  const [tab, setTab] = useState<TabKey>('productos');
  const isProducts = tab === 'productos';

  /* ------------------------------ LISTADOS --------------------------------- */
  const [productStatusFilter, setProductStatusFilter] = useState<string | null>(null);
  const productList = usePaginatedList<Product>(fetchProducts, {
    filters: { status: productStatusFilter ?? undefined },
  });

  const [categoryStatusFilter, setCategoryStatusFilter] = useState<string | null>(null);
  const categoryList = usePaginatedList<Category>(fetchCategories, {
    filters: { status: categoryStatusFilter ?? undefined },
  });

  /* --------------------- CATÁLOGOS PARA LOS SELECT -------------------------- */
  const [categoryCatalog, setCategoryCatalog] = useState<Category[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<Supplier[]>([]);

  const loadCatalog = useCallback(() => {
    const categoriesReq = can('categories.read')
      ? categoriesService.list({ limit: 100 }).then((r) => r.items)
      : Promise.resolve<Category[]>([]);
    const suppliersReq = can('suppliers.read')
      ? suppliersService.list({ limit: 100, status: 'active' }).then((r) => r.items)
      : Promise.resolve<Supplier[]>([]);
    Promise.all([categoriesReq, suppliersReq])
      .then(([categories, suppliers]) => {
        setCategoryCatalog(categories);
        setSupplierOptions(suppliers);
      })
      .catch((err) => toast.error(toApiError(err).message));
  }, [can, toast]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  /* --------------------- ESTADO DEL FORM. DE PRODUCTO ---------------------- */
  const [productFormVisible, setProductFormVisible] = useState(false);
  const [productEditing, setProductEditing] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState>(EMPTY_PRODUCT_FORM);
  const [productFieldErrors, setProductFieldErrors] = useState<Record<string, string | undefined>>({});
  const [productSaving, setProductSaving] = useState(false);
  const [productToDeactivate, setProductToDeactivate] = useState<Product | null>(null);
  const [productDeactivating, setProductDeactivating] = useState(false);

  const openCreateProduct = () => {
    setProductEditing(null);
    setProductForm(EMPTY_PRODUCT_FORM);
    setProductFieldErrors({});
    setProductFormVisible(true);
  };

  const openEditProduct = (row: Product) => {
    setProductEditing(row);
    setProductForm({
      sku: row.sku,
      name: row.name,
      description: row.description ?? '',
      categoryId: categoryIdOf(row.categoryId),
      supplierId: row.supplierId ?? '',
      purchasePrice: row.purchasePrice == null ? '' : String(row.purchasePrice),
      salePrice: row.salePrice == null ? '' : String(row.salePrice),
      stockMin: row.stockMin == null ? '' : String(row.stockMin),
      unit: row.unit ?? 'unidad',
      status: row.status,
    });
    setProductFieldErrors({});
    setProductFormVisible(true);
  };

  const saveProduct = async () => {
    setProductFieldErrors({});
    const errors: Record<string, string | undefined> = {};
    if (!productForm.sku.trim()) errors.sku = 'El SKU es obligatorio';
    if (!productForm.name.trim()) errors.name = 'El nombre es obligatorio';
    if (!productForm.categoryId) errors.categoryId = 'Selecciona una categoría';

    const purchasePrice = parseNumeric(productForm.purchasePrice);
    if (!productForm.purchasePrice.trim()) {
      errors.purchasePrice = 'El precio de compra es obligatorio';
    } else if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
      errors.purchasePrice = 'Debe ser un número mayor o igual a 0';
    }

    const salePrice = parseNumeric(productForm.salePrice);
    if (!productForm.salePrice.trim()) {
      errors.salePrice = 'El precio de venta es obligatorio';
    } else if (!Number.isFinite(salePrice) || salePrice < 0) {
      errors.salePrice = 'Debe ser un número mayor o igual a 0';
    }

    let stockMin: number | undefined;
    if (productForm.stockMin.trim()) {
      const parsed = parseNumeric(productForm.stockMin);
      if (!Number.isFinite(parsed) || parsed < 0) {
        errors.stockMin = 'Debe ser un número mayor o igual a 0';
      } else {
        stockMin = parsed;
      }
    }

    if (Object.values(errors).some(Boolean)) {
      setProductFieldErrors(errors);
      return;
    }

    setProductSaving(true);
    try {
      const payload: ProductInput = {
        sku: productForm.sku.trim(),
        name: productForm.name.trim(),
        description: productForm.description.trim() || undefined,
        categoryId: productForm.categoryId,
        supplierId: productForm.supplierId || null,
        purchasePrice,
        salePrice,
        stockMin,
        unit: productForm.unit,
        status: productForm.status,
      };
      if (productEditing) {
        await productsService.update(productEditing._id, payload);
        toast.success('Producto actualizado');
      } else {
        await productsService.create(payload);
        toast.success('Producto creado');
      }
      setProductFormVisible(false);
      productList.reload();
    } catch (err) {
      const apiError = toApiError(err);
      setProductFieldErrors({
        sku: apiError.fieldError('sku'),
        name: apiError.fieldError('name'),
        description: apiError.fieldError('description'),
        categoryId: apiError.fieldError('categoryId'),
        supplierId: apiError.fieldError('supplierId'),
        purchasePrice: apiError.fieldError('purchasePrice'),
        salePrice: apiError.fieldError('salePrice'),
        stockMin: apiError.fieldError('stockMin'),
        unit: apiError.fieldError('unit'),
        status: apiError.fieldError('status'),
      });
      if (!apiError.details?.length) toast.error(apiError.message);
    } finally {
      setProductSaving(false);
    }
  };

  const deactivateProduct = async () => {
    if (!productToDeactivate) return;
    setProductDeactivating(true);
    try {
      await productsService.deactivate(productToDeactivate._id);
      toast.success('Producto desactivado');
      setProductToDeactivate(null);
      productList.reload();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setProductDeactivating(false);
    }
  };

  /* --------------------- ESTADO DEL FORM. DE CATEGORÍA --------------------- */
  const [categoryFormVisible, setCategoryFormVisible] = useState(false);
  const [categoryEditing, setCategoryEditing] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(EMPTY_CATEGORY_FORM);
  const [categoryFieldErrors, setCategoryFieldErrors] = useState<Record<string, string | undefined>>({});
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryToDeactivate, setCategoryToDeactivate] = useState<Category | null>(null);
  const [categoryDeactivating, setCategoryDeactivating] = useState(false);

  const openCreateCategory = () => {
    setCategoryEditing(null);
    setCategoryForm(EMPTY_CATEGORY_FORM);
    setCategoryFieldErrors({});
    setCategoryFormVisible(true);
  };

  const openEditCategory = (row: Category) => {
    setCategoryEditing(row);
    setCategoryForm({ name: row.name, description: row.description ?? '', status: row.status });
    setCategoryFieldErrors({});
    setCategoryFormVisible(true);
  };

  const saveCategory = async () => {
    setCategoryFieldErrors({});
    if (!categoryForm.name.trim()) {
      setCategoryFieldErrors({ name: 'El nombre es obligatorio' });
      return;
    }
    setCategorySaving(true);
    try {
      const payload: CategoryInput = {
        ...categoryForm,
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim() || undefined,
      };
      if (categoryEditing) {
        await categoriesService.update(categoryEditing._id, payload);
        toast.success('Categoría actualizada');
      } else {
        await categoriesService.create(payload);
        toast.success('Categoría creada');
      }
      setCategoryFormVisible(false);
      categoryList.reload();
      loadCatalog(); // el desplegable de productos debe ver la categoría nueva/editada
    } catch (err) {
      const apiError = toApiError(err);
      setCategoryFieldErrors({
        name: apiError.fieldError('name'),
        description: apiError.fieldError('description'),
        status: apiError.fieldError('status'),
      });
      if (!apiError.details?.length) toast.error(apiError.message);
    } finally {
      setCategorySaving(false);
    }
  };

  const deactivateCategory = async () => {
    if (!categoryToDeactivate) return;
    setCategoryDeactivating(true);
    try {
      await categoriesService.deactivate(categoryToDeactivate._id);
      toast.success('Categoría desactivada');
      setCategoryToDeactivate(null);
      categoryList.reload();
      loadCatalog();
    } catch (err) {
      // p. ej. 409: productos activos siguen usando la categoría
      toast.error(toApiError(err).message);
    } finally {
      setCategoryDeactivating(false);
    }
  };

  /* ------------------------------- COLUMNAS -------------------------------- */
  const productColumns: TableColumn<Product>[] = [
    { key: 'sku', label: 'SKU', width: 120 },
    { key: 'name', label: 'Nombre' },
    {
      key: 'categoryId',
      label: 'Categoría',
      width: 170,
      render: (row) => (
        <Text style={[styles.cellText, { color: c.text }]} numberOfLines={2}>
          {categoryNameOf(row.categoryId, categoryCatalog)}
        </Text>
      ),
    },
    {
      key: 'salePrice',
      label: 'Precio venta',
      width: 130,
      render: (row) => <Text style={[styles.cellText, { color: c.text }]}>{formatCurrency(row.salePrice)}</Text>,
    },
    {
      key: 'stockMin',
      label: 'Stock mínimo',
      width: 120,
      render: (row) => <Text style={[styles.cellText, { color: c.text }]}>{formatNumber(row.stockMin)}</Text>,
    },
    {
      key: 'unit',
      label: 'Unidad',
      width: 100,
      render: (row) => <Text style={[styles.cellText, { color: c.text }]}>{unitLabel(row.unit)}</Text>,
    },
    {
      key: 'status',
      label: 'Estado',
      width: 110,
      render: (row) => {
        const status = STATUS_BADGES[row.status];
        return <Badge label={status.label} tone={status.tone} />;
      },
    },
    {
      key: '_actions',
      label: 'Acciones',
      width: 200,
      render: (row) => (
        <View style={styles.rowActions}>
          {can('products.update') && row.status === 'active' ? (
            <Button title="Editar" variant="secondary" size="sm" onPress={() => openEditProduct(row)} />
          ) : null}
          {can('products.delete') && row.status === 'active' ? (
            <Button
              title="Desactivar"
              variant="ghost"
              size="sm"
              onPress={() => setProductToDeactivate(row)}
            />
          ) : null}
        </View>
      ),
    },
  ];

  const categoryColumns: TableColumn<Category>[] = [
    { key: 'name', label: 'Nombre' },
    { key: 'description', label: 'Descripción', width: 280 },
    {
      key: 'status',
      label: 'Estado',
      width: 110,
      render: (row) => {
        const status = STATUS_BADGES[row.status];
        return <Badge label={status.label} tone={status.tone} />;
      },
    },
    {
      key: '_actions',
      label: 'Acciones',
      width: 200,
      render: (row) => (
        <View style={styles.rowActions}>
          {can('categories.update') && row.status === 'active' ? (
            <Button title="Editar" variant="secondary" size="sm" onPress={() => openEditCategory(row)} />
          ) : null}
          {can('categories.delete') && row.status === 'active' ? (
            <Button
              title="Desactivar"
              variant="ghost"
              size="sm"
              onPress={() => setCategoryToDeactivate(row)}
            />
          ) : null}
        </View>
      ),
    },
  ];

  const categorySelectOptions = categoryCatalog.map((category) => ({
    value: category._id,
    label: category.name,
  }));

  const supplierSelectOptions = [
    // El backend ignora supplierId nulo en PATCH: no se permite quitar un proveedor ya asignado.
    { value: '', label: 'Sin proveedor', disabled: Boolean(productEditing?.supplierId) },
    ...supplierOptions.map((supplier) => ({
      value: supplier._id,
      label: supplier.companyName ? `${supplier.name} — ${supplier.companyName}` : supplier.name,
    })),
  ];

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <ScreenHeader
        title={isProducts ? 'Productos' : 'Categorías'}
        subtitle={
          isProducts
            ? `${productList.total} ${productList.total === 1 ? 'producto registrado' : 'productos registrados'}`
            : `${categoryList.total} ${categoryList.total === 1 ? 'categoría registrada' : 'categorías registradas'}`
        }
        actions={
          isProducts ? (
            can('products.create') ? <Button title="Nuevo producto" onPress={openCreateProduct} /> : undefined
          ) : can('categories.create') ? (
            <Button title="Nueva categoría" onPress={openCreateCategory} />
          ) : undefined
        }
      />

      {/* Selector de sección (segmented control propio con Button) */}
      <View style={styles.segmented}>
        <Button
          title="Productos"
          size="sm"
          variant={isProducts ? 'primary' : 'ghost'}
          onPress={() => setTab('productos')}
          style={styles.segmentBtn}
        />
        <Button
          title="Categorías"
          size="sm"
          variant={isProducts ? 'ghost' : 'primary'}
          onPress={() => setTab('categorias')}
          style={styles.segmentBtn}
        />
      </View>

      {isProducts ? (
        <Card>
          <View style={styles.toolbar}>
            <SearchInput
              value={productList.search}
              onChange={productList.setSearch}
              placeholder="Buscar por nombre, SKU o descripción…"
            />
            <View style={{ width: 190 }}>
              <Select
                label="Estado"
                value={productStatusFilter}
                options={[
                  { value: '', label: 'Todos' },
                  ...STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
                ]}
                onChange={(value) => setProductStatusFilter(value || null)}
                placeholder="Todos"
              />
            </View>
          </View>

          {productList.loading && productList.items.length === 0 ? (
            <LoadingState message="Cargando productos…" />
          ) : productList.error ? (
            <ErrorState message={productList.error} onRetry={productList.reload} />
          ) : productList.items.length === 0 ? (
            <EmptyState
              title="Sin productos"
              message={
                productList.search
                  ? 'Ningún producto coincide con la búsqueda.'
                  : 'Todavía no hay productos dados de alta.'
              }
            />
          ) : (
            <>
              <DataTable columns={productColumns} rows={productList.items} rowKey={(row) => row._id} />
              <Pagination
                page={productList.page}
                totalPages={productList.totalPages}
                total={productList.total}
                onPageChange={productList.setPage}
                loading={productList.loading}
              />
            </>
          )}
        </Card>
      ) : (
        <Card>
          <View style={styles.toolbar}>
            <SearchInput
              value={categoryList.search}
              onChange={categoryList.setSearch}
              placeholder="Buscar por nombre o descripción…"
            />
            <View style={{ width: 190 }}>
              <Select
                label="Estado"
                value={categoryStatusFilter}
                options={[
                  { value: '', label: 'Todos' },
                  ...STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
                ]}
                onChange={(value) => setCategoryStatusFilter(value || null)}
                placeholder="Todos"
              />
            </View>
          </View>

          {categoryList.loading && categoryList.items.length === 0 ? (
            <LoadingState message="Cargando categorías…" />
          ) : categoryList.error ? (
            <ErrorState message={categoryList.error} onRetry={categoryList.reload} />
          ) : categoryList.items.length === 0 ? (
            <EmptyState
              title="Sin categorías"
              message={
                categoryList.search
                  ? 'Ninguna categoría coincide con la búsqueda.'
                  : 'Todavía no hay categorías dadas de alta.'
              }
            />
          ) : (
            <>
              <DataTable columns={categoryColumns} rows={categoryList.items} rowKey={(row) => row._id} />
              <Pagination
                page={categoryList.page}
                totalPages={categoryList.totalPages}
                total={categoryList.total}
                onPageChange={categoryList.setPage}
                loading={categoryList.loading}
              />
            </>
          )}
        </Card>
      )}

      {/* Formulario crear/editar producto */}
      <Modal
        visible={productFormVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProductFormVisible(false)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: c.overlay }]}
          onPress={() => setProductFormVisible(false)}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.formWrap}>
            <Pressable style={[styles.form, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.formTitle, { color: c.text }]}>
                {productEditing ? 'Editar producto' : 'Nuevo producto'}
              </Text>

              <View style={styles.formRow}>
                <Input
                  label="SKU *"
                  value={productForm.sku}
                  onChangeText={(v) => setProductForm((f) => ({ ...f, sku: v }))}
                  error={productFieldErrors.sku}
                  placeholder="SKU del producto"
                  editable={!productSaving}
                  autoCapitalize="characters"
                  containerStyle={styles.formCol}
                />
                <Input
                  label="Nombre *"
                  value={productForm.name}
                  onChangeText={(v) => setProductForm((f) => ({ ...f, name: v }))}
                  error={productFieldErrors.name}
                  placeholder="Nombre del producto"
                  editable={!productSaving}
                  containerStyle={styles.formCol}
                />
              </View>
              <Input
                label="Descripción"
                value={productForm.description}
                onChangeText={(v) => setProductForm((f) => ({ ...f, description: v }))}
                error={productFieldErrors.description}
                placeholder="Descripción (opcional)"
                editable={!productSaving}
              />
              <Select
                label="Categoría *"
                value={productForm.categoryId}
                options={categorySelectOptions}
                onChange={(value) => setProductForm((f) => ({ ...f, categoryId: value }))}
                error={productFieldErrors.categoryId}
                placeholder="Selecciona una categoría"
                disabled={productSaving}
              />
              <Select
                label="Proveedor"
                value={productForm.supplierId}
                options={supplierSelectOptions}
                onChange={(value) => setProductForm((f) => ({ ...f, supplierId: value }))}
                error={productFieldErrors.supplierId}
                placeholder="Selecciona un proveedor"
                disabled={productSaving}
              />
              <View style={styles.formRow}>
                <Input
                  label="Precio de compra *"
                  value={productForm.purchasePrice}
                  onChangeText={(v) => setProductForm((f) => ({ ...f, purchasePrice: v }))}
                  error={productFieldErrors.purchasePrice}
                  keyboardType="numeric"
                  placeholder="0,00"
                  editable={!productSaving}
                  containerStyle={styles.formCol}
                />
                <Input
                  label="Precio de venta *"
                  value={productForm.salePrice}
                  onChangeText={(v) => setProductForm((f) => ({ ...f, salePrice: v }))}
                  error={productFieldErrors.salePrice}
                  keyboardType="numeric"
                  placeholder="0,00"
                  editable={!productSaving}
                  containerStyle={styles.formCol}
                />
              </View>
              <View style={styles.formRow}>
                <Input
                  label="Stock mínimo"
                  value={productForm.stockMin}
                  onChangeText={(v) => setProductForm((f) => ({ ...f, stockMin: v }))}
                  error={productFieldErrors.stockMin}
                  keyboardType="numeric"
                  placeholder="0"
                  editable={!productSaving}
                  containerStyle={styles.formCol}
                />
                <Select
                  label="Unidad"
                  value={productForm.unit}
                  options={UNIT_OPTIONS}
                  onChange={(value) => setProductForm((f) => ({ ...f, unit: value }))}
                  error={productFieldErrors.unit}
                  disabled={productSaving}
                  containerStyle={styles.formCol}
                />
              </View>
              {productEditing ? (
                <Select
                  label="Estado"
                  value={productForm.status}
                  options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  onChange={(value) => setProductForm((f) => ({ ...f, status: value as Status }))}
                  disabled={productSaving}
                />
              ) : null}

              <View style={styles.formActions}>
                <Button
                  title="Cancelar"
                  variant="ghost"
                  onPress={() => setProductFormVisible(false)}
                  disabled={productSaving}
                />
                <Button
                  title={productEditing ? 'Guardar cambios' : 'Crear producto'}
                  onPress={() => void saveProduct()}
                  loading={productSaving}
                />
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Confirmación de baja lógica de producto */}
      <ConfirmDialog
        visible={productToDeactivate !== null}
        title="Desactivar producto"
        message={`Se desactivará "${productToDeactivate?.name ?? ''}". Podrás consultarlo con el filtro de estado, pero no en operaciones nuevas.`}
        confirmLabel="Desactivar"
        destructive
        loading={productDeactivating}
        onConfirm={() => void deactivateProduct()}
        onCancel={() => setProductToDeactivate(null)}
      />

      {/* Formulario crear/editar categoría */}
      <Modal
        visible={categoryFormVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryFormVisible(false)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: c.overlay }]}
          onPress={() => setCategoryFormVisible(false)}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.formWrap}>
            <Pressable style={[styles.form, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.formTitle, { color: c.text }]}>
                {categoryEditing ? 'Editar categoría' : 'Nueva categoría'}
              </Text>

              <Input
                label="Nombre *"
                value={categoryForm.name}
                onChangeText={(v) => setCategoryForm((f) => ({ ...f, name: v }))}
                error={categoryFieldErrors.name}
                placeholder="Nombre de la categoría"
                editable={!categorySaving}
              />
              <Input
                label="Descripción"
                value={categoryForm.description}
                onChangeText={(v) => setCategoryForm((f) => ({ ...f, description: v }))}
                error={categoryFieldErrors.description}
                placeholder="Descripción (opcional)"
                editable={!categorySaving}
              />
              {categoryEditing ? (
                <Select
                  label="Estado"
                  value={categoryForm.status}
                  options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  onChange={(value) => setCategoryForm((f) => ({ ...f, status: value as Status }))}
                  disabled={categorySaving}
                />
              ) : null}

              <View style={styles.formActions}>
                <Button
                  title="Cancelar"
                  variant="ghost"
                  onPress={() => setCategoryFormVisible(false)}
                  disabled={categorySaving}
                />
                <Button
                  title={categoryEditing ? 'Guardar cambios' : 'Crear categoría'}
                  onPress={() => void saveCategory()}
                  loading={categorySaving}
                />
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Confirmación de baja lógica de categoría */}
      <ConfirmDialog
        visible={categoryToDeactivate !== null}
        title="Desactivar categoría"
        message={`Se desactivará "${categoryToDeactivate?.name ?? ''}". No podrá usarse en productos nuevos.`}
        confirmLabel="Desactivar"
        destructive
        loading={categoryDeactivating}
        onConfirm={() => void deactivateCategory()}
        onCancel={() => setCategoryToDeactivate(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 40 },
  segmented: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  segmentBtn: { flexGrow: 1 },
  toolbar: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 },
  rowActions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  cellText: { fontSize: 14 },
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
  formRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  formCol: { flexGrow: 1, minWidth: 180 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
});
