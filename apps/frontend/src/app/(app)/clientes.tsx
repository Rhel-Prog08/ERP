import React, { useState } from 'react';
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
import { customersService, type CustomerInput } from '../../services/customersService';
import type { Customer } from '../../types/models';
import { STATUS_OPTIONS } from '../../constants/statuses';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import {
  ADDRESS_MAX,
  COMPANY_MAX,
  NAME_MAX,
  PHONE_MAXLENGTH_INPUT,
  buildContactPayload,
  validateContactForm,
  type ContactFormErrors,
  type ContactFormValues,
} from '../../utils/validators';
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

/** Estado del formulario: campos de contacto + estado del registro. */
type ContactFormState = ContactFormValues & { status: Customer['status'] };

const EMPTY_FORM: ContactFormState = {
  name: '',
  companyName: '',
  email: '',
  phone: '',
  address: '',
  status: 'active',
};

/** Clientes: CRUD real contra /api/v1/customers (búsqueda ?q=, paginación). */
export default function ClientesScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const toast = useToast();
  const { can } = useAuth();

  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const list = usePaginatedList<Customer>((params) => customersService.list(params), {
    filters: { status: statusFilter ?? undefined },
  });

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<ContactFormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [toDeactivate, setToDeactivate] = useState<Customer | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFormVisible(true);
  };

  const openEdit = (row: Customer) => {
    setEditing(row);
    setForm({
      name: row.name,
      companyName: row.companyName ?? '',
      email: row.email ?? '',
      phone: row.phone ?? '',
      address: row.address ?? '',
      status: row.status,
    });
    setFieldErrors({});
    setFormVisible(true);
  };

  const save = async () => {
    setFieldErrors({});
    // Reglas MX (espejo del backend): nombre 2–120; la creación exige email y
    // teléfono; en edición sólo se valida lo modificado respecto al registro.
    const original: ContactFormValues | undefined = editing
      ? {
          name: editing.name,
          email: editing.email ?? '',
          phone: editing.phone ?? '',
          companyName: editing.companyName ?? '',
          address: editing.address ?? '',
        }
      : undefined;
    const errors: ContactFormErrors = validateContactForm(form, {
      requireContact: !editing,
      original,
    });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setSaving(true);
    try {
      // En edición se omiten los campos no modificados: no se reenvían valores
      // antiguos (posiblemente inválidos) al backend.
      const payload: CustomerInput = {
        ...buildContactPayload(form, original),
        status: form.status,
      };
      if (editing) {
        await customersService.update(editing._id, payload);
        toast.success('Cliente actualizado');
      } else {
        await customersService.create(payload);
        toast.success('Cliente creado');
      }
      setFormVisible(false);
      list.reload();
    } catch (err) {
      const apiError = toApiError(err);
      setFieldErrors({
        name: apiError.fieldError('name'),
        companyName: apiError.fieldError('companyName'),
        email: apiError.fieldError('email'),
        phone: apiError.fieldError('phone'),
        address: apiError.fieldError('address'),
      });
      if (!apiError.details?.length) toast.error(apiError.message);
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    if (!toDeactivate) return;
    setDeactivating(true);
    try {
      await customersService.deactivate(toDeactivate._id);
      toast.success('Cliente desactivado');
      setToDeactivate(null);
      list.reload();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setDeactivating(false);
    }
  };

  const columns: TableColumn<Customer>[] = [
    { key: 'customerCode', label: 'Código', width: 110 },
    { key: 'name', label: 'Nombre' },
    { key: 'companyName', label: 'Empresa' },
    { key: 'email', label: 'Email', width: 200 },
    { key: 'phone', label: 'Teléfono', width: 140 },
    {
      key: 'status',
      label: 'Estado',
      width: 110,
      render: (row) => (
        <Badge
          label={row.status === 'active' ? 'Activo' : 'Inactivo'}
          tone={row.status === 'active' ? 'success' : 'neutral'}
        />
      ),
    },
    {
      key: '_actions',
      label: 'Acciones',
      width: 200,
      render: (row) => (
        <View style={styles.rowActions}>
          {can('customers.update') && row.status === 'active' ? (
            <Button title="Editar" variant="secondary" size="sm" onPress={() => openEdit(row)} />
          ) : null}
          {can('customers.delete') && row.status === 'active' ? (
            <Button title="Desactivar" variant="ghost" size="sm" onPress={() => setToDeactivate(row)} />
          ) : null}
        </View>
      ),
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <ScreenHeader
        title="Clientes"
        subtitle={`${list.total} ${list.total === 1 ? 'cliente registrado' : 'clientes registrados'}`}
        actions={
          can('customers.create') ? <Button title="Nuevo cliente" onPress={openCreate} /> : undefined
        }
      />

      <Card>
        <View style={styles.toolbar}>
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Buscar por nombre, empresa o código…" />
          <View style={{ width: 190 }}>
            <Select
              label="Estado"
              value={statusFilter}
              options={[{ value: '', label: 'Todos' }, ...STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]}
              onChange={(value) => setStatusFilter(value || null)}
              placeholder="Todos"
            />
          </View>
        </View>

        {list.loading && list.items.length === 0 ? (
          <LoadingState message="Cargando clientes…" />
        ) : list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : list.items.length === 0 ? (
          <EmptyState
            title="Sin clientes"
            message={list.search ? 'Ningún cliente coincide con la búsqueda.' : 'Todavía no hay clientes dados de alta.'}
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

      {/* Formulario crear/editar */}
      <Modal visible={formVisible} transparent animationType="fade" onRequestClose={() => setFormVisible(false)}>
        <Pressable style={[styles.backdrop, { backgroundColor: c.overlay }]} onPress={() => setFormVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.formWrap}>
            <Pressable style={[styles.form, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.formTitle, { color: c.text }]}>
                {editing ? 'Editar cliente' : 'Nuevo cliente'}
              </Text>

              <Input
                label="Nombre *"
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                error={fieldErrors.name}
                placeholder="Nombre del cliente"
                maxLength={NAME_MAX}
                editable={!saving}
              />
              <Input
                label="Empresa"
                value={form.companyName}
                onChangeText={(v) => setForm((f) => ({ ...f, companyName: v }))}
                error={fieldErrors.companyName}
                placeholder="Razón social (opcional)"
                maxLength={COMPANY_MAX}
                editable={!saving}
              />
              <View style={styles.formRow}>
                <Input
                  label={editing ? 'Email' : 'Email *'}
                  value={form.email}
                  onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
                  error={fieldErrors.email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="correo@empresa.com"
                  editable={!saving}
                  containerStyle={styles.formCol}
                />
                <Input
                  label={editing ? 'Teléfono' : 'Teléfono *'}
                  value={form.phone}
                  onChangeText={(v) => setForm((f) => ({ ...f, phone: v.replace(/[^0-9]/g, '') }))}
                  error={fieldErrors.phone}
                  keyboardType="numeric"
                  maxLength={PHONE_MAXLENGTH_INPUT}
                  placeholder="10 dígitos"
                  hint="Sólo dígitos, exactamente 10"
                  editable={!saving}
                  containerStyle={styles.formCol}
                />
              </View>
              <Input
                label="Dirección"
                value={form.address}
                onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
                error={fieldErrors.address}
                placeholder="Dirección (opcional)"
                maxLength={ADDRESS_MAX}
                editable={!saving}
              />
              {editing ? (
                <Select
                  label="Estado"
                  value={form.status ?? 'active'}
                  options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  onChange={(value) => setForm((f) => ({ ...f, status: value as Customer['status'] }))}
                  disabled={saving}
                />
              ) : null}

              <View style={styles.formActions}>
                <Button title="Cancelar" variant="ghost" onPress={() => setFormVisible(false)} disabled={saving} />
                <Button title={editing ? 'Guardar cambios' : 'Crear cliente'} onPress={() => void save()} loading={saving} />
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Confirmación de baja lógica */}
      <ConfirmDialog
        visible={toDeactivate !== null}
        title="Desactivar cliente"
        message={`Se desactivará "${toDeactivate?.name ?? ''}". Podrás consultarlo con el filtro de estado, pero no en operaciones nuevas.`}
        confirmLabel="Desactivar"
        destructive
        loading={deactivating}
        onConfirm={() => void deactivate()}
        onCancel={() => setToDeactivate(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 40 },
  toolbar: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 },
  rowActions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
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
