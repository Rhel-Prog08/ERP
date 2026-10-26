import React, { useCallback, useState } from 'react';
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
import { usersService } from '../../services/usersService';
import { rolesService } from '../../services/rolesService';
import type { Invitation, Role, Status, User, UserUpdateInput } from '../../types/models';
import type { QueryParams } from '../../types/api';
import { formatDateTime } from '../../utils/format';
import { STATUS_BADGES, STATUS_OPTIONS } from '../../constants/statuses';
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

/** La política de contraseñas del backend exige mínimo 8 caracteres. */
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface UserForm {
  firstName: string;
  lastName: string;
  email: string;
  /** Sólo en alta. */
  password: string;
  /** Sólo en edición (vacío = no cambiar). */
  newPassword: string;
  roleId: string;
  status: Status;
}

const EMPTY_FORM: UserForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  newPassword: '',
  roleId: '',
  status: 'active',
};

/** Nombre del rol: viene poblado (objeto) o como id (se resuelve con /roles). */
function roleName(row: User, roles: Role[]): string {
  if (typeof row.roleId === 'object' && row.roleId !== null) return row.roleId.name;
  const found = roles.find((r) => r._id === row.roleId);
  return found ? found.name : '—';
}

/** Usuarios: CRUD real contra /api/v1/users (búsqueda ?q=, filtro status, paginación). */
export default function UsuariosScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const toast = useToast();
  const { can, user } = useAuth();

  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const fetchUsers = useCallback((params: QueryParams) => usersService.list(params), []);
  const list = usePaginatedList<User>(fetchUsers, {
    filters: { status: statusFilter ?? undefined },
  });

  // Catálogo de roles para el Select del formulario y para resolver roleId string.
  const [roles, setRoles] = useState<Role[]>([]);
  React.useEffect(() => {
    let active = true;
    rolesService
      .list()
      .then((data) => {
        if (active) setRoles(data);
      })
      .catch(() => {
        // Sin roles.read el formulario de alta lo validará como campo obligatorio.
      });
    return () => {
      active = false;
    };
  }, []);

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [toDeactivate, setToDeactivate] = useState<User | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  /* ------------------- Invitaciones de registro (FASE 3) ------------------- */
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteErrors, setInviteErrors] = useState<Record<string, string | undefined>>({});
  const [inviteForm, setInviteForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    roleId: '',
  });
  const [toRevoke, setToRevoke] = useState<Invitation | null>(null);
  const [revoking, setRevoking] = useState(false);

  const loadInvites = useCallback(() => {
    setInvitesLoading(true);
    setInvitesError(null);
    usersService
      .listInvitations({ limit: 20, status: 'pending' })
      .then((data) => setInvites(data.items))
      .catch((err) => setInvitesError(toApiError(err).message))
      .finally(() => setInvitesLoading(false));
  }, []);

  React.useEffect(() => {
    if (!can('users.read')) return;
    // Arranque aplazado un tick: el setState de carga no se ejecuta de forma
    // síncrona dentro del effect (regla set-state-in-effect). El resultado y
    // el orden de la carga son idénticos.
    const t = setTimeout(loadInvites, 0);
    return () => clearTimeout(t);
  }, [can, loadInvites]);

  const openInvite = () => {
    setInviteForm({
      firstName: '',
      lastName: '',
      email: '',
      roleId: roles.length === 1 ? roles[0]._id : '',
    });
    setInviteErrors({});
    setInviteVisible(true);
  };

  const saveInvite = async () => {
    const errors: Record<string, string | undefined> = {};
    const mail = inviteForm.email.trim().toLowerCase();
    if (!inviteForm.firstName.trim()) errors.firstName = 'Introduce el nombre';
    if (!inviteForm.lastName.trim()) errors.lastName = 'Introduce los apellidos';
    if (!mail) errors.email = 'Introduce el correo electrónico';
    else if (!EMAIL_RE.test(mail)) errors.email = 'El correo no tiene un formato válido';
    if (!inviteForm.roleId) errors.roleId = 'Selecciona un rol';
    setInviteErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    setInviteSaving(true);
    try {
      await usersService.createInvitation({
        ...inviteForm,
        email: mail,
        firstName: inviteForm.firstName.trim(),
        lastName: inviteForm.lastName.trim(),
      });
      setInviteVisible(false);
      toast.success('Invitación enviada al correo indicado');
      loadInvites();
    } catch (err) {
      const apiError = toApiError(err);
      setInviteErrors({
        email: apiError.fieldError('email'),
        roleId: apiError.fieldError('roleId'),
        firstName: apiError.fieldError('firstName'),
        lastName: apiError.fieldError('lastName'),
        form: apiError.message,
      });
    } finally {
      setInviteSaving(false);
    }
  };

  const revokeInvite = async () => {
    if (!toRevoke) return;
    setRevoking(true);
    try {
      await usersService.revokeInvitation(toRevoke._id);
      setToRevoke(null);
      toast.success('Invitación revocada');
      loadInvites();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setRevoking(false);
    }
  };

  /** Protección: nadie edita ni desactiva su propia cuenta desde esta pantalla. */
  const isSelf = (row: User) => row._id === user?.id;

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, roleId: roles.length === 1 ? roles[0]._id : '' });
    setFieldErrors({});
    setFormVisible(true);
  };

  const openEdit = (row: User) => {
    if (isSelf(row)) {
      toast.error('No puedes editar tu propia cuenta desde esta pantalla');
      return;
    }
    setEditing(row);
    setForm({
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      password: '',
      newPassword: '',
      roleId: typeof row.roleId === 'object' && row.roleId !== null ? row.roleId._id : row.roleId,
      status: row.status,
    });
    setFieldErrors({});
    setFormVisible(true);
  };

  const requestDeactivate = (row: User) => {
    if (isSelf(row)) {
      toast.error('No puedes desactivar tu propia cuenta');
      return;
    }
    setToDeactivate(row);
  };

  const save = async () => {
    setFieldErrors({});
    const errs: Record<string, string | undefined> = {};
    if (!form.firstName.trim()) errs.firstName = 'El nombre es obligatorio';
    if (!form.lastName.trim()) errs.lastName = 'El apellido es obligatorio';
    if (!form.email.trim()) errs.email = 'El email es obligatorio';
    else if (!EMAIL_RE.test(form.email.trim())) errs.email = 'Introduce un email válido';
    if (!form.roleId) errs.roleId = 'Selecciona un rol';
    if (!editing && form.password.length < MIN_PASSWORD_LENGTH) {
      errs.password = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`;
    }
    if (editing && form.newPassword && form.newPassword.length < MIN_PASSWORD_LENGTH) {
      errs.newPassword = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`;
    }
    if (Object.values(errs).some(Boolean)) {
      setFieldErrors(errs);
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const payload: UserUpdateInput = {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          roleId: form.roleId,
          status: form.status,
        };
        if (form.newPassword.trim()) payload.newPassword = form.newPassword.trim();
        await usersService.update(editing._id, payload);
        toast.success('Usuario actualizado');
      } else {
        await usersService.create({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          password: form.password,
          roleId: form.roleId,
          status: form.status,
        });
        toast.success('Usuario creado');
      }
      setFormVisible(false);
      list.reload();
    } catch (err) {
      const apiError = toApiError(err);
      setFieldErrors({
        firstName: apiError.fieldError('firstName'),
        lastName: apiError.fieldError('lastName'),
        email: apiError.fieldError('email'),
        password: apiError.fieldError('password'),
        newPassword: apiError.fieldError('newPassword'),
        roleId: apiError.fieldError('roleId'),
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
      await usersService.deactivate(toDeactivate._id);
      toast.success('Usuario desactivado');
      setToDeactivate(null);
      list.reload();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setDeactivating(false);
    }
  };

  const roleOptions = roles.map((r) => ({ value: r._id, label: r.name }));

  const columns: TableColumn<User>[] = [
    {
      key: 'name',
      label: 'Nombre',
      render: (row) => (
        <Text style={styles.cellText}>{`${row.firstName} ${row.lastName}`.trim()}</Text>
      ),
    },
    { key: 'email', label: 'Email', width: 220 },
    {
      key: 'role',
      label: 'Rol',
      width: 150,
      render: (row) => <Text style={styles.cellText}>{roleName(row, roles)}</Text>,
    },
    {
      key: 'status',
      label: 'Estado',
      width: 150,
      render: (row) => {
        const info = STATUS_BADGES[row.status];
        const pendingVerify = row.verificationRequired && !row.emailVerifiedAt;
        return (
          <View style={styles.statusCell}>
            <Badge label={info.label} tone={info.tone} />
            {pendingVerify ? <Badge label="Sin verificar" tone="warning" /> : null}
          </View>
        );
      },
    },
    {
      key: 'lastLoginAt',
      label: 'Último acceso',
      width: 160,
      render: (row) => (
        <Text style={styles.cellMuted}>{row.lastLoginAt ? formatDateTime(row.lastLoginAt) : 'Nunca'}</Text>
      ),
    },
    {
      key: '_actions',
      label: 'Acciones',
      width: 190,
      render: (row) => (
        <View style={styles.rowActions}>
          {can('users.update') && !isSelf(row) ? (
            <Button title="Editar" variant="secondary" size="sm" onPress={() => openEdit(row)} />
          ) : null}
          {can('users.delete') && !isSelf(row) && row.status === 'active' ? (
            <Button title="Desactivar" variant="ghost" size="sm" onPress={() => requestDeactivate(row)} />
          ) : null}
        </View>
      ),
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <ScreenHeader
        title="Usuarios"
        subtitle={`${list.total} ${list.total === 1 ? 'usuario registrado' : 'usuarios registrados'}`}
        actions={
          can('users.create') ? (
            <View style={styles.headerActions}>
              <Button title="Invitar usuario" variant="secondary" onPress={openInvite} />
              <Button title="Nuevo usuario" onPress={openCreate} />
            </View>
          ) : undefined
        }
      />

      <Card>
        <View style={styles.toolbar}>
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Buscar por nombre o email…" />
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
          <LoadingState message="Cargando usuarios…" />
        ) : list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : list.items.length === 0 ? (
          <EmptyState
            title="Sin usuarios"
            message={list.search ? 'Ningún usuario coincide con la búsqueda.' : 'Todavía no hay usuarios dados de alta.'}
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

      {/* Invitaciones de registro pendientes (sólo con users.read). */}
      {can('users.read') ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: c.text }]}>Invitaciones pendientes</Text>
          <Text style={[styles.sectionHint, { color: c.textMuted }]}>
            El rol y la empresa los eliges tú: la cuenta nueva queda atada a esta empresa y no
            podrá autoasignarse privilegios. El registro sólo se habilita con proveedor de correo
            real configurado.
          </Text>

          {invitesLoading && invites.length === 0 ? (
            <LoadingState message="Cargando invitaciones…" />
          ) : invitesError ? (
            <ErrorState message={invitesError} onRetry={loadInvites} />
          ) : invites.length === 0 ? (
            <EmptyState
              title="Sin invitaciones pendientes"
              message="Las invitaciones creadas aparecerán aquí hasta que se usen o caduquen."
            />
          ) : (
            <View style={styles.inviteList}>
              {invites.map((inv) => (
                <View
                  key={inv._id}
                  style={[styles.inviteRow, { borderColor: c.border }]}
                >
                  <View style={{ flex: 1, minWidth: 200 }}>
                    <Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>
                      {`${inv.firstName} ${inv.lastName}`.trim()}
                    </Text>
                    <Text style={{ color: c.textMuted, fontSize: 13 }}>{inv.email}</Text>
                    <Text style={{ color: c.textLight, fontSize: 12 }}>
                      Caduca: {formatDateTime(inv.expiresAt)}
                    </Text>
                  </View>
                  {can('users.update') ? (
                    <Button
                      title="Revocar"
                      variant="ghost"
                      size="sm"
                      onPress={() => setToRevoke(inv)}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </Card>
      ) : null}

      {/* Formulario crear/editar */}
      <Modal visible={formVisible} transparent animationType="fade" onRequestClose={() => setFormVisible(false)}>
        <Pressable style={[styles.backdrop, { backgroundColor: c.overlay }]} onPress={() => setFormVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.formWrap}>
            <Pressable style={[styles.form, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.formTitle, { color: c.text }]}>
                {editing ? 'Editar usuario' : 'Nuevo usuario'}
              </Text>

              <View style={styles.formRow}>
                <Input
                  label="Nombre *"
                  value={form.firstName}
                  onChangeText={(v) => setForm((f) => ({ ...f, firstName: v }))}
                  error={fieldErrors.firstName}
                  placeholder="Nombre"
                  editable={!saving}
                  containerStyle={styles.formCol}
                />
                <Input
                  label="Apellidos *"
                  value={form.lastName}
                  onChangeText={(v) => setForm((f) => ({ ...f, lastName: v }))}
                  error={fieldErrors.lastName}
                  placeholder="Apellidos"
                  editable={!saving}
                  containerStyle={styles.formCol}
                />
              </View>
              <Input
                label="Email *"
                value={form.email}
                onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
                error={fieldErrors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="correo@empresa.com"
                editable={!saving}
              />
              {editing ? (
                <Input
                  label="Nueva contraseña (vacío = no cambiar)"
                  value={form.newPassword}
                  onChangeText={(v) => setForm((f) => ({ ...f, newPassword: v }))}
                  error={fieldErrors.newPassword}
                  secureTextEntry
                  hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                  placeholder="Dejar en blanco para mantener la actual"
                  editable={!saving}
                />
              ) : (
                <Input
                  label="Contraseña *"
                  value={form.password}
                  onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
                  error={fieldErrors.password}
                  secureTextEntry
                  hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                  placeholder="Contraseña inicial"
                  editable={!saving}
                />
              )}
              <Select
                label="Rol *"
                value={form.roleId || null}
                options={roleOptions}
                onChange={(value) => setForm((f) => ({ ...f, roleId: value }))}
                error={fieldErrors.roleId}
                placeholder="Selecciona un rol"
                disabled={saving || roles.length === 0}
              />
              <Select
                label="Estado"
                value={form.status}
                options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                onChange={(value) => setForm((f) => ({ ...f, status: value as Status }))}
                disabled={saving}
              />

              <View style={styles.formActions}>
                <Button title="Cancelar" variant="ghost" onPress={() => setFormVisible(false)} disabled={saving} />
                <Button title={editing ? 'Guardar cambios' : 'Crear usuario'} onPress={() => void save()} loading={saving} />
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Confirmación de baja lógica */}
      <ConfirmDialog
        visible={toDeactivate !== null}
        title="Desactivar usuario"
        message={`Se desactivará a "${toDeactivate ? `${toDeactivate.firstName} ${toDeactivate.lastName}`.trim() : ''}" y se cerrarán sus sesiones. Podrás consultarlo con el filtro de estado.`}
        confirmLabel="Desactivar"
        destructive
        loading={deactivating}
        onConfirm={() => void deactivate()}
        onCancel={() => setToDeactivate(null)}
      />

      {/* Formulario de invitación de registro */}
      <Modal
        visible={inviteVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteVisible(false)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: c.overlay }]}
          onPress={() => setInviteVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.formWrap}
          >
            <Pressable style={[styles.form, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.formTitle, { color: c.text }]}>Invitar usuario</Text>

              {inviteErrors.form ? (
                <View style={[styles.errorBox, { backgroundColor: c.dangerBg }]}>
                  <Text style={{ color: c.danger, fontSize: 13, fontWeight: '600' }}>
                    {inviteErrors.form}
                  </Text>
                </View>
              ) : null}

              <View style={styles.formRow}>
                <Input
                  label="Nombre *"
                  value={inviteForm.firstName}
                  onChangeText={(v) => setInviteForm((f) => ({ ...f, firstName: v }))}
                  error={inviteErrors.firstName}
                  placeholder="Nombre"
                  editable={!inviteSaving}
                  containerStyle={styles.formCol}
                />
                <Input
                  label="Apellidos *"
                  value={inviteForm.lastName}
                  onChangeText={(v) => setInviteForm((f) => ({ ...f, lastName: v }))}
                  error={inviteErrors.lastName}
                  placeholder="Apellidos"
                  editable={!inviteSaving}
                  containerStyle={styles.formCol}
                />
              </View>
              <Input
                label="Email *"
                value={inviteForm.email}
                onChangeText={(v) => setInviteForm((f) => ({ ...f, email: v }))}
                error={inviteErrors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="correo@empresa.com"
                hint="Recibirá el enlace de registro por correo"
                editable={!inviteSaving}
              />
              <Select
                label="Rol *"
                value={inviteForm.roleId || null}
                options={roleOptions}
                onChange={(value) => setInviteForm((f) => ({ ...f, roleId: value }))}
                error={inviteErrors.roleId}
                placeholder="Selecciona un rol"
                disabled={inviteSaving || roles.length === 0}
              />

              <View style={styles.formActions}>
                <Button
                  title="Cancelar"
                  variant="ghost"
                  onPress={() => setInviteVisible(false)}
                  disabled={inviteSaving}
                />
                <Button
                  title="Enviar invitación"
                  onPress={() => void saveInvite()}
                  loading={inviteSaving}
                />
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Confirmación de revocación de invitación */}
      <ConfirmDialog
        visible={toRevoke !== null}
        title="Revocar invitación"
        message={`Se revocará la invitación de "${toRevoke ? toRevoke.email : ''}": el enlace dejará de funcionar y no se podrá completar el registro.`}
        confirmLabel="Revocar"
        destructive
        loading={revoking}
        onConfirm={() => void revokeInvite()}
        onCancel={() => setToRevoke(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 40 },
  toolbar: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 },
  rowActions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  statusCell: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  headerActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  sectionHint: { fontSize: 12, lineHeight: 17 },
  inviteList: { gap: 10 },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  errorBox: { borderRadius: 10, padding: 12 },
  cellText: { fontSize: 14 },
  cellMuted: { fontSize: 13, color: '#64748b' },
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
