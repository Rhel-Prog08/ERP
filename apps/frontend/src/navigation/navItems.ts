import type { ComponentProps } from 'react';
import type { Href } from 'expo-router';
import type { Ionicons } from '@expo/vector-icons';

/**
 * Estructura de navegación del ERP (espejo de los módulos del backend).
 * Cada ítem declara su permiso de lectura: el menú se filtra con RBAC.
 */

export interface NavItem {
  key: string;
  label: string;
  href: Href;
  icon: ComponentProps<typeof Ionicons>['name'];
  /** Permiso mínimo requerido para ver el ítem. */
  permission: string;
}

export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'general',
    label: 'General',
    items: [
      { key: 'dashboard', label: 'Dashboard', href: '/', icon: 'grid-outline', permission: 'dashboard.read' },
      { key: 'reportes', label: 'Reportes', href: '/reportes', icon: 'stats-chart-outline', permission: 'reports.read' },
    ],
  },
  {
    key: 'operaciones',
    label: 'Operaciones',
    items: [
      { key: 'ventas', label: 'Ventas', href: '/ventas', icon: 'cart-outline', permission: 'sales.read' },
      { key: 'compras', label: 'Compras', href: '/compras', icon: 'bag-handle-outline', permission: 'purchases.read' },
      { key: 'inventario', label: 'Inventario', href: '/inventario', icon: 'layers-outline', permission: 'inventory.read' },
    ],
  },
  {
    key: 'catalogos',
    label: 'Catálogos',
    items: [
      { key: 'productos', label: 'Productos', href: '/productos', icon: 'cube-outline', permission: 'products.read' },
      { key: 'clientes', label: 'Clientes', href: '/clientes', icon: 'people-outline', permission: 'customers.read' },
      { key: 'proveedores', label: 'Proveedores', href: '/proveedores', icon: 'business-outline', permission: 'suppliers.read' },
    ],
  },
  {
    key: 'administracion',
    label: 'Administración',
    items: [
      { key: 'usuarios', label: 'Usuarios', href: '/usuarios', icon: 'person-circle-outline', permission: 'users.read' },
      { key: 'roles', label: 'Roles', href: '/roles', icon: 'shield-checkmark-outline', permission: 'roles.read' },
      { key: 'auditoria', label: 'Auditoría', href: '/auditoria', icon: 'time-outline', permission: 'audit.read' },
      { key: 'configuracion', label: 'Configuración', href: '/configuracion', icon: 'settings-outline', permission: 'settings.read' },
    ],
  },
];

/** Grupos con al menos un ítem visible para los permisos dados. */
export function visibleNavGroups(permissions: Set<string>): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => permissions.has(item.permission)),
  })).filter((group) => group.items.length > 0);
}
