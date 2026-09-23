'use strict';

/**
 * Catálogo central de permisos, roles, enums y acciones de auditoría.
 * Única fuente de verdad: la BD de `permissions` y los roles se siembran
 * a partir de aquí (ver database/seed.js).
 */

/* ---------------------------------------------------------------
 * PERMISOS — clave pública: <módulo>.<acción>
 * ------------------------------------------------------------- */
const PERMISSION_LIST = [
  // Usuarios / roles
  { key: 'users.read', module: 'users', action: 'read', description: 'Consultar usuarios' },
  { key: 'users.create', module: 'users', action: 'create', description: 'Crear usuarios' },
  { key: 'users.update', module: 'users', action: 'update', description: 'Actualizar usuarios' },
  { key: 'users.delete', module: 'users', action: 'delete', description: 'Desactivar usuarios (borrado lógico)' },
  { key: 'roles.read', module: 'roles', action: 'read', description: 'Consultar roles' },
  { key: 'roles.create', module: 'roles', action: 'create', description: 'Crear roles' },
  { key: 'roles.update', module: 'roles', action: 'update', description: 'Modificar roles y permisos' },
  { key: 'roles.delete', module: 'roles', action: 'delete', description: 'Eliminar roles no sistema' },
  { key: 'permissions.read', module: 'permissions', action: 'read', description: 'Consultar catálogo de permisos' },

  // Organización
  { key: 'companies.read', module: 'companies', action: 'read', description: 'Consultar empresas' },
  { key: 'companies.create', module: 'companies', action: 'create', description: 'Crear empresas (multiempresa)' },
  { key: 'companies.update', module: 'companies', action: 'update', description: 'Actualizar la empresa propia' },
  { key: 'branches.read', module: 'branches', action: 'read', description: 'Consultar sucursales' },
  { key: 'branches.create', module: 'branches', action: 'create', description: 'Crear sucursales' },
  { key: 'branches.update', module: 'branches', action: 'update', description: 'Actualizar sucursales' },
  { key: 'branches.delete', module: 'branches', action: 'delete', description: 'Desactivar sucursales' },
  { key: 'warehouses.read', module: 'warehouses', action: 'read', description: 'Consultar almacenes' },
  { key: 'warehouses.create', module: 'warehouses', action: 'create', description: 'Crear almacenes' },
  { key: 'warehouses.update', module: 'warehouses', action: 'update', description: 'Actualizar almacenes' },
  { key: 'warehouses.delete', module: 'warehouses', action: 'delete', description: 'Desactivar almacenes' },

  // Maestros
  { key: 'customers.read', module: 'customers', action: 'read', description: 'Consultar clientes' },
  { key: 'customers.create', module: 'customers', action: 'create', description: 'Crear clientes' },
  { key: 'customers.update', module: 'customers', action: 'update', description: 'Actualizar clientes' },
  { key: 'customers.delete', module: 'customers', action: 'delete', description: 'Desactivar clientes' },
  { key: 'suppliers.read', module: 'suppliers', action: 'read', description: 'Consultar proveedores' },
  { key: 'suppliers.create', module: 'suppliers', action: 'create', description: 'Crear proveedores' },
  { key: 'suppliers.update', module: 'suppliers', action: 'update', description: 'Actualizar proveedores' },
  { key: 'suppliers.delete', module: 'suppliers', action: 'delete', description: 'Desactivar proveedores' },
  { key: 'categories.read', module: 'categories', action: 'read', description: 'Consultar categorías' },
  { key: 'categories.create', module: 'categories', action: 'create', description: 'Crear categorías' },
  { key: 'categories.update', module: 'categories', action: 'update', description: 'Actualizar categorías' },
  { key: 'categories.delete', module: 'categories', action: 'delete', description: 'Desactivar categorías' },
  { key: 'products.read', module: 'products', action: 'read', description: 'Consultar productos' },
  { key: 'products.create', module: 'products', action: 'create', description: 'Crear productos' },
  { key: 'products.update', module: 'products', action: 'update', description: 'Actualizar productos' },
  { key: 'products.delete', module: 'products', action: 'delete', description: 'Desactivar productos' },

  // Inventario
  { key: 'inventory.read', module: 'inventory', action: 'read', description: 'Consultar existencias y movimientos' },
  { key: 'inventory.entry', module: 'inventory', action: 'entry', description: 'Registrar entradas/devoluciones' },
  { key: 'inventory.exit', module: 'inventory', action: 'exit', description: 'Registrar salidas' },
  { key: 'inventory.adjust', module: 'inventory', action: 'adjust', description: 'Ajustar existencias' },

  // Operaciones
  { key: 'sales.read', module: 'sales', action: 'read', description: 'Consultar ventas' },
  { key: 'sales.create', module: 'sales', action: 'create', description: 'Crear y editar borradores de venta' },
  { key: 'sales.update', module: 'sales', action: 'update', description: 'Confirmar/completar ventas' },
  { key: 'sales.cancel', module: 'sales', action: 'cancel', description: 'Cancelar ventas' },
  { key: 'purchases.read', module: 'purchases', action: 'read', description: 'Consultar compras' },
  { key: 'purchases.create', module: 'purchases', action: 'create', description: 'Crear y editar borradores de compra' },
  { key: 'purchases.update', module: 'purchases', action: 'update', description: 'Confirmar/recibir compras' },
  { key: 'purchases.cancel', module: 'purchases', action: 'cancel', description: 'Cancelar compras' },

  // Informes y control
  { key: 'dashboard.read', module: 'dashboard', action: 'read', description: 'Ver panel de indicadores' },
  { key: 'reports.read', module: 'reports', action: 'read', description: 'Generar reportes' },
  { key: 'reports.export', module: 'reports', action: 'export', description: 'Exportar reportes (CSV)' },
  { key: 'audit.read', module: 'audit', action: 'read', description: 'Consultar auditoría (solo lectura)' },
  { key: 'settings.read', module: 'settings', action: 'read', description: 'Ver configuración de la empresa' },
  { key: 'settings.update', module: 'settings', action: 'update', description: 'Modificar configuración de la empresa' },
  { key: 'notifications.read', module: 'notifications', action: 'read', description: 'Ver notificaciones' },
  { key: 'notifications.update', module: 'notifications', action: 'update', description: 'Gestionar notificaciones' },
];

const ALL_PERMISSIONS = PERMISSION_LIST.map((p) => p.key);

/* ---------------------------------------------------------------
 * ROLES POR EMPRESA — cada empresa recibe su propio juego de roles
 * ------------------------------------------------------------- */
const DEFAULT_ROLES = ['Administrador', 'Gerente', 'Ventas', 'Compras', 'Almacén', 'Consulta'];

function perms(...keys) {
  return keys;
}

/** Permisos por defecto de cada rol (sembrados por empresa). */
const ROLE_PERMISSIONS = {
  Administrador: ALL_PERMISSIONS,

  Gerente: perms(
    'users.read', 'roles.read', 'permissions.read',
    'companies.read', 'branches.read', 'warehouses.read',
    'customers.read', 'customers.create', 'customers.update', 'customers.delete',
    'suppliers.read', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
    'categories.read', 'categories.create', 'categories.update', 'categories.delete',
    'products.read', 'products.create', 'products.update', 'products.delete',
    'inventory.read', 'inventory.entry', 'inventory.exit', 'inventory.adjust',
    'sales.read', 'sales.create', 'sales.update', 'sales.cancel',
    'purchases.read', 'purchases.create', 'purchases.update', 'purchases.cancel',
    'dashboard.read', 'reports.read', 'reports.export', 'audit.read',
    'settings.read', 'settings.update',
    'notifications.read', 'notifications.update'
  ),

  Ventas: perms(
    'warehouses.read',
    'customers.read', 'customers.create', 'customers.update',
    'suppliers.read',
    'categories.read', 'products.read',
    'inventory.read',
    'sales.read', 'sales.create', 'sales.update', 'sales.cancel',
    'dashboard.read', 'reports.read',
    'notifications.read'
  ),

  Compras: perms(
    'warehouses.read',
    'suppliers.read', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
    'categories.read', 'products.read', 'products.create', 'products.update',
    'inventory.read', 'inventory.entry',
    'purchases.read', 'purchases.create', 'purchases.update', 'purchases.cancel',
    'dashboard.read', 'reports.read',
    'notifications.read'
  ),

  Almacén: perms(
    'warehouses.read',
    'suppliers.read',
    'categories.read', 'products.read',
    'inventory.read', 'inventory.entry', 'inventory.exit', 'inventory.adjust',
    'purchases.read', 'purchases.update',
    'dashboard.read', 'reports.read',
    'notifications.read', 'notifications.update'
  ),

  Consulta: perms(
    'users.read',
    'companies.read', 'branches.read', 'warehouses.read',
    'customers.read', 'suppliers.read', 'categories.read', 'products.read',
    'inventory.read', 'sales.read', 'purchases.read',
    'dashboard.read', 'reports.read',
    'notifications.read', 'settings.read'
    // Sin audit.read ni gestión de roles: viewer de solo lectura.
  ),
};

/* ---------------------------------------------------------------
 * ENUMS
 * ------------------------------------------------------------- */
const STATUS = { ACTIVE: 'active', INACTIVE: 'inactive' };
const STATUSES = [STATUS.ACTIVE, STATUS.INACTIVE];

const MOVEMENT_TYPES = ['ENTRY', 'EXIT', 'ADJUSTMENT', 'RETURN'];

/** Permiso requerido según tipo de movimiento de inventario. */
const MOVEMENT_PERMISSION = {
  ENTRY: 'inventory.entry',
  RETURN: 'inventory.entry',
  EXIT: 'inventory.exit',
  ADJUSTMENT: 'inventory.adjust',
};

const SALE_STATUS = ['DRAFT', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
const PURCHASE_STATUS = ['DRAFT', 'CONFIRMED', 'RECEIVED', 'CANCELLED'];

const UNITS = ['unidad', 'caja', 'kilo', 'litro', 'metro', 'pack'];

const SETTINGS_DEFAULTS = {
  taxRate: 0.21,
  allowNegativeStock: false,
};

/* ---------------------------------------------------------------
 * AUDITORÍA — acciones registradas en auditLogs
 * ------------------------------------------------------------- */
const AUDIT_ACTIONS = [
  'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
  'CREATE_USER', 'UPDATE_USER', 'DEACTIVATE_USER', 'CHANGE_PASSWORD',
  'CREATE_ROLE', 'UPDATE_ROLE', 'DELETE_ROLE', 'ROLE_CHANGE',
  'CREATE_COMPANY', 'UPDATE_COMPANY',
  'CREATE_BRANCH', 'UPDATE_BRANCH', 'DELETE_BRANCH',
  'CREATE_WAREHOUSE', 'UPDATE_WAREHOUSE', 'DELETE_WAREHOUSE',
  'CREATE_CUSTOMER', 'UPDATE_CUSTOMER', 'DELETE_CUSTOMER',
  'CREATE_SUPPLIER', 'UPDATE_SUPPLIER', 'DELETE_SUPPLIER',
  'CREATE_CATEGORY', 'UPDATE_CATEGORY', 'DELETE_CATEGORY',
  'CREATE_PRODUCT', 'UPDATE_PRODUCT', 'DELETE_PRODUCT',
  'STOCK_ENTRY', 'STOCK_EXIT', 'STOCK_ADJUSTMENT', 'STOCK_RETURN',
  'CREATE_SALE', 'CONFIRM_SALE', 'COMPLETE_SALE', 'CANCEL_SALE',
  'CREATE_PURCHASE', 'CONFIRM_PURCHASE', 'RECEIVE_PURCHASE', 'CANCEL_PURCHASE',
  'UPDATE_SETTINGS',
  'EXPORT_REPORT',
];

/** Acción de auditoría derivada del tipo de movimiento de stock. */
const MOVEMENT_AUDIT_ACTION = {
  ENTRY: 'STOCK_ENTRY',
  EXIT: 'STOCK_EXIT',
  ADJUSTMENT: 'STOCK_ADJUSTMENT',
  RETURN: 'STOCK_RETURN',
};

module.exports = {
  PERMISSION_LIST,
  ALL_PERMISSIONS,
  DEFAULT_ROLES,
  ROLE_PERMISSIONS,
  STATUS,
  STATUSES,
  MOVEMENT_TYPES,
  MOVEMENT_PERMISSION,
  MOVEMENT_AUDIT_ACTION,
  SALE_STATUS,
  PURCHASE_STATUS,
  UNITS,
  SETTINGS_DEFAULTS,
  AUDIT_ACTIONS,
};
