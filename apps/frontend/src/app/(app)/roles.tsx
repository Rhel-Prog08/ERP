import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { rolesService } from '../../services/rolesService';
import { permissionsService } from '../../services/permissionsService';
import type { Permission, Role, Status } from '../../types/models';
import { STATUS_BADGES, STATUS_OPTIONS } from '../../constants/statuses';
import { MODULE_LABELS, MODULE_ORDER, PERMISSION_LABELS } from '../../constants/permissions';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { DataTable, type TableColumn } from '../../components/ui/DataTable';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';

/** Un permiso del catálogo listo para pintar en el editor. */
interface CatalogItem {
  key: string;
  label: string;
}

/** Grupo de permisos (un módulo) con su orden de presentación. */
interface PermissionGroup {
  module: string;
  label: string;
  items: CatalogItem[];
}

/** Orden por MODULE_ORDER; los módulos desconocidos quedan al final por nombre. */
function moduleRank(module: string): number {
  const idx = MODULE_ORDER.indexOf(module);
  return idx === -1 ? MODULE_ORDER.length : idx;
}

/** Agrupa el catálogo real de GET /permissions por módulo. */
function buildGroupsFromCatalog(catalog: Permission[]): PermissionGroup[] {
  const byModule = new Map<string, CatalogItem[]>();
  for (const perm of catalog) {
    const list = byModule.get(perm.module) ?? [];
    list.push({ key: perm.key, label: PERMISSION_LABELS[perm.key] ?? perm.key });
    byModule.set(perm.module, list);
  }
  return [...byModule.entries()]
    .map(([module, items]) => ({
      module,
      label: MODULE_LABELS[module] ?? module,
      items: items.sort((a, b) => a.label.localeCompare(b.label, 'es')),
    }))
    .sort((a, b) => moduleRank(a.module) - moduleRank(b.module) || a.label.localeCompare(b.label, 'es'));
}

/** Fallback local: agrupa las claves de PERMISSION_LABELS por el prefijo antes del punto. */
function buildGroupsFromLabels(): PermissionGroup[] {
  const byModule = new Map<string, CatalogItem[]>();
  for (const [key, label] of Object.entries(PERMISSION_LABELS)) {
    const module = key.split('.')[0] ?? key;
    const list = byModule.get(module) ?? [];
    list.push({ key, label });
    byModule.set(module, list);
  }
  return [...byModule.entries()]
    .map(([module, items]) => ({
      module,
      label: MODULE_LABELS[module] ?? module,
      items,
    }))
    .sort((a, b) => moduleRank(a.module) - moduleRank(b.module));
}

/** Casilla propia (Pressable + ✓): evita dependencias nativas extra en web. */
function Checkbox({
  checked,
  onToggle,
  label,
  disabled = false,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      onPress={onToggle}
      disabled={disabled}
      style={styles.checkRow}
    >
      <View
        style={[
          styles.checkBox,
          {
            borderColor: checked ? c.primary : c.border,
            backgroundColor: checked ? c.primary : c.card,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        {checked ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
      <Text style={[styles.checkLabel, { color: disabled ? c.textMuted : c.text }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Roles: lista + editor de permisos agrupado por módulo (/roles y /permissions). */
export default function RolesScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const toast = useToast();
  const { can, user } = useAuth();

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Catálogo de permisos: real (GET /permissions) con fallback a PERMISSION_LABELS.
  const [groups, setGroups] = useState<PermissionGroup[]>(() => buildGroupsFromLabels());
  const [catalogFromApi, setCatalogFromApi] = useState(false);

  /** Recarga manual (evento): sí puede marcar loading de forma síncrona. */
  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadToken((t) => t + 1);
  }, []);

  useEffect(() => {
    let active = true;
    rolesService
      .list()
      .then((data) => {
        if (active) setRoles(data);
      })
      .catch((err) => {
        if (active) setError(toApiError(err).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadToken]);

  useEffect(() => {
    let active = true;
    permissionsService
      .list()
      .then((catalog) => {
        if (!active || catalog.length === 0) return;
        setGroups(buildGroupsFromCatalog(catalog));
        setCatalogFromApi(true);
      })
      .catch(() => {
        // Se mantiene el fallback agrupado por PREFIJO de PERMISSION_LABELS.
      });
    return () => {
      active = false;
    };
  }, []);

  const [editing, setEditing] = useState<Role | null>(null);
  /** true → el editor está abierto en modo alta (editing === null). */
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formStatus, setFormStatus] = useState<Status>('active');
  /** Marcado por clave de permiso (incluye claves del rol ausentes del catálogo). */
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

  /** El backend prohíbe tocar los permisos del rol propio (409). */
  const isOwnRole = editing !== null && user?.role?.id === editing._id;

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  );

  const openEdit = (row: Role) => {
    setCreating(false);
    setEditing(row);
    setFormName(row.name);
    setFormStatus(row.status);
    const next: Record<string, boolean> = {};
    for (const group of groups) {
      for (const item of group.items) next[item.key] = false;
    }
    for (const key of row.permissions) next[key] = true;
    setSelected(next);
    setFieldErrors({});
  };

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setFormName('');
    setFormStatus('active');
    const next: Record<string, boolean> = {};
    for (const group of groups) {
      for (const item of group.items) next[item.key] = false;
    }
    setSelected(next);
    setFieldErrors({});
  };

  const closeEditor = () => {
    setEditing(null);
    setCreating(false);
  };

  const togglePermission = (key: string) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleGroup = (group: PermissionGroup) => {
    setSelected((prev) => {
      const allChecked = group.items.every((item) => prev[item.key]);
      const next = { ...prev };
      for (const item of group.items) next[item.key] = !allChecked;
      return next;
    });
  };

  const save = async () => {
    if (!editing && !creating) return;
    setFieldErrors({});

    const errs: Record<string, string | undefined> = {};
    if (!formName.trim()) errs.name = 'El nombre es obligatorio';
    const permissionKeys = Object.keys(selected).filter((key) => selected[key]);
    if (!isOwnRole && permissionKeys.length === 0) {
      errs.permissions = 'Selecciona al menos un permiso';
    }
    if (Object.values(errs).some(Boolean)) {
      setFieldErrors(errs);
      return;
    }

    setSaving(true);
    try {
      if (creating) {
        await rolesService.create({
          name: formName.trim(),
          status: formStatus,
          permissions: permissionKeys,
        });
        toast.success('Rol creado');
      } else if (editing) {
        await rolesService.update(editing._id, {
          name: formName.trim(),
          status: formStatus,
          // El rol propio se edita sólo en nombre/estado (el backend rechaza cambios de permisos).
          ...(isOwnRole ? {} : { permissions: permissionKeys }),
        });
        toast.success(isOwnRole ? 'Rol actualizado (los permisos de tu rol no se modifican)' : 'Rol guardado');
      }
      closeEditor();
      reload();
    } catch (err) {
      const apiError = toApiError(err);
      setFieldErrors({
        name: apiError.fieldError('name'),
        permissions: apiError.fieldError('permissions'),
      });
      if (!apiError.details?.length) toast.error(apiError.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await rolesService.remove(toDelete._id);
      toast.success('Rol eliminado');
      setToDelete(null);
      reload();
    } catch (err) {
      // p. ej. 409 si es rol de sistema o hay usuarios activos usándolo.
      toast.error(toApiError(err).message);
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<Role>[] = [
    { key: 'name', label: 'Rol' },
    {
      key: 'permissions',
      label: 'Permisos',
      width: 100,
      align: 'right',
      render: (row) => <Text style={styles.cellText}>{row.permissions.length}</Text>,
    },
    {
      key: 'isSystem',
      label: 'Origen',
      width: 110,
      render: (row) => (
        <Badge label={row.isSystem ? 'Sistema' : 'Personal'} tone={row.isSystem ? 'info' : 'neutral'} />
      ),
    },
    {
      key: 'status',
      label: 'Estado',
      width: 110,
      render: (row) => {
        const info = STATUS_BADGES[row.status];
        return <Badge label={info.label} tone={info.tone} />;
      },
    },
    {
      key: '_actions',
      label: 'Acciones',
      width: 200,
      render: (row) => (
        <View style={styles.rowActions}>
          {can('roles.update') ? (
            <Button title="Editar" variant="secondary" size="sm" onPress={() => openEdit(row)} />
          ) : null}
          {can('roles.delete') && !row.isSystem ? (
            <Button title="Eliminar" variant="ghost" size="sm" onPress={() => setToDelete(row)} />
          ) : null}
        </View>
      ),
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <ScreenHeader
        title="Roles"
        subtitle={`${roles.length} ${roles.length === 1 ? 'rol definido' : 'roles definidos'} en tu empresa`}
        actions={
          can('roles.create') ? (
            <Button title="Nuevo rol" onPress={openCreate} />
          ) : undefined
        }
      />

      <Card>
        {loading ? (
          <LoadingState message="Cargando roles…" />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : roles.length === 0 ? (
          <EmptyState title="Sin roles" message="Todavía no hay roles definidos en tu empresa." />
        ) : (
          <DataTable columns={columns} rows={roles} rowKey={(row) => row._id} />
        )}
      </Card>

      {/* Editor de rol con catálogo de permisos */}
      <Modal
        visible={editing !== null || creating}
        transparent
        animationType="fade"
        onRequestClose={closeEditor}
      >
        <Pressable style={[styles.backdrop, { backgroundColor: c.overlay }]} onPress={closeEditor}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.formWrap}>
            <Pressable style={[styles.form, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.formTitle, { color: c.text }]}>{creating ? 'Nuevo rol' : 'Editar rol'}</Text>

              <Input
                label="Nombre *"
                value={formName}
                onChangeText={setFormName}
                error={fieldErrors.name}
                placeholder="Nombre del rol"
                editable={!saving}
              />
              <Select
                label="Estado"
                value={formStatus}
                options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                onChange={(value) => setFormStatus(value as Status)}
                disabled={saving}
              />

              <View style={styles.permHeader}>
                <Text style={[styles.permTitle, { color: c.text }]}>
                  Permisos ({selectedCount} seleccionados)
                </Text>
                <Text style={[styles.permHint, { color: c.textMuted }]}>
                  {catalogFromApi ? 'Catálogo del servidor' : 'Catálogo local (sin /permissions)'}
                </Text>
              </View>
              {isOwnRole ? (
                <Text style={[styles.ownRoleNote, { color: c.warning }]}>
                  Es tu rol actual: sólo puedes cambiar su nombre y estado, no sus permisos.
                </Text>
              ) : null}
              {fieldErrors.permissions ? (
                <Text style={[styles.permError, { color: c.danger }]}>{fieldErrors.permissions}</Text>
              ) : null}

              <ScrollView style={styles.permScroll} contentContainerStyle={styles.permScrollContent}>
                {groups.map((group) => {
                  const allChecked = group.items.every((item) => selected[item.key]);
                  return (
                    <View key={group.module} style={[styles.permGroup, { borderColor: c.border }]}>
                      <Pressable
                        onPress={() => toggleGroup(group)}
                        disabled={saving || isOwnRole}
                        style={styles.permGroupHeader}
                        accessibilityRole="button"
                      >
                        <View
                          style={[
                            styles.checkBox,
                            {
                              borderColor: allChecked ? c.primary : c.border,
                              backgroundColor: allChecked ? c.primary : c.card,
                              opacity: isOwnRole ? 0.6 : 1,
                            },
                          ]}
                        >
                          {allChecked ? <Text style={styles.checkMark}>✓</Text> : null}
                        </View>
                        <Text style={[styles.permGroupLabel, { color: c.text }]}>{group.label}</Text>
                        <Text style={[styles.permGroupCount, { color: c.textMuted }]}>
                          {group.items.filter((item) => selected[item.key]).length}/{group.items.length}
                        </Text>
                      </Pressable>

                      <View style={styles.permItems}>
                        {group.items.map((item) => (
                          <Checkbox
                            key={item.key}
                            checked={Boolean(selected[item.key])}
                            onToggle={() => togglePermission(item.key)}
                            label={item.label}
                            disabled={saving || isOwnRole}
                          />
                        ))}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              <View style={styles.formActions}>
                <Button title="Cancelar" variant="ghost" onPress={closeEditor} disabled={saving} />
                <Button title="Guardar" onPress={() => void save()} loading={saving} />
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Confirmación de borrado (sólo roles no sistema) */}
      <ConfirmDialog
        visible={toDelete !== null}
        title="Eliminar rol"
        message={`Se eliminará el rol "${toDelete?.name ?? ''}". No podrá eliminarse si hay usuarios activos usándolo.`}
        confirmLabel="Eliminar"
        destructive
        loading={deleting}
        onConfirm={() => void remove()}
        onCancel={() => setToDelete(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 40 },
  rowActions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  cellText: { fontSize: 14 },
  backdrop: { flex: 1, justifyContent: 'center', padding: 16 },
  formWrap: { width: '100%', alignItems: 'center' },
  form: {
    width: '100%',
    maxWidth: 620,
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
    gap: 12,
  },
  formTitle: { fontSize: 18, fontWeight: '800' },
  permHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  permTitle: { fontSize: 14, fontWeight: '700' },
  permHint: { fontSize: 12 },
  ownRoleNote: { fontSize: 12, fontWeight: '600' },
  permError: { fontSize: 12, fontWeight: '500' },
  permScroll: { maxHeight: 340 },
  permScrollContent: { gap: 10, paddingRight: 4 },
  permGroup: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  permGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  permGroupLabel: { fontSize: 14, fontWeight: '700', flex: 1 },
  permGroupCount: { fontSize: 12 },
  permItems: { paddingHorizontal: 12, paddingBottom: 8, gap: 2 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  checkBox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  checkLabel: { fontSize: 13, flex: 1 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
});
