import type {
  MovementType,
  PurchaseStatus,
  SaleStatus,
  Status,
  Unit,
} from '../types/models';

/** Tono del semáforo de badges: verde / ámbar / rojo / gris (+ azul info). */
export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export interface BadgeInfo {
  label: string;
  tone: BadgeTone;
}

export const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
];

export const STATUS_BADGES: Record<Status, BadgeInfo> = {
  active: { label: 'Activo', tone: 'success' },
  inactive: { label: 'Inactivo', tone: 'neutral' },
};

export const SALE_STATUS_OPTIONS: { value: SaleStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'CONFIRMED', label: 'Confirmada' },
  { value: 'COMPLETED', label: 'Completada' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

export const SALE_STATUS_BADGES: Record<SaleStatus, BadgeInfo> = {
  DRAFT: { label: 'Borrador', tone: 'neutral' },
  CONFIRMED: { label: 'Confirmada', tone: 'warning' },
  COMPLETED: { label: 'Completada', tone: 'success' },
  CANCELLED: { label: 'Cancelada', tone: 'danger' },
};

export const PURCHASE_STATUS_OPTIONS: { value: PurchaseStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'CONFIRMED', label: 'Confirmada' },
  { value: 'RECEIVED', label: 'Recibida' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

export const PURCHASE_STATUS_BADGES: Record<PurchaseStatus, BadgeInfo> = {
  DRAFT: { label: 'Borrador', tone: 'neutral' },
  CONFIRMED: { label: 'Confirmada', tone: 'warning' },
  RECEIVED: { label: 'Recibida', tone: 'success' },
  CANCELLED: { label: 'Cancelada', tone: 'danger' },
};

export const MOVEMENT_TYPES: MovementType[] = ['ENTRY', 'EXIT', 'ADJUSTMENT', 'RETURN'];

export const MOVEMENT_OPTIONS: { value: MovementType; label: string }[] = [
  { value: 'ENTRY', label: 'Entrada' },
  { value: 'EXIT', label: 'Salida' },
  { value: 'ADJUSTMENT', label: 'Ajuste' },
  { value: 'RETURN', label: 'Devolución' },
];

export const MOVEMENT_BADGES: Record<MovementType, BadgeInfo> = {
  ENTRY: { label: 'Entrada', tone: 'success' },
  RETURN: { label: 'Devolución', tone: 'success' },
  EXIT: { label: 'Salida', tone: 'danger' },
  ADJUSTMENT: { label: 'Ajuste', tone: 'warning' },
};

export const UNITS: Unit[] = ['unidad', 'caja', 'kilo', 'litro', 'metro', 'pack'];

export const UNIT_OPTIONS: { value: Unit; label: string }[] = UNITS.map((u) => ({
  value: u,
  label: u.charAt(0).toUpperCase() + u.slice(1),
}));

/** Todas las acciones de auditoría (AUDIT_ACTIONS del backend). */
export const AUDIT_ACTIONS = [
  'LOGIN',
  'LOGOUT',
  'LOGIN_FAILED',
  'CREATE_USER',
  'UPDATE_USER',
  'DEACTIVATE_USER',
  'CHANGE_PASSWORD',
  'CREATE_ROLE',
  'UPDATE_ROLE',
  'DELETE_ROLE',
  'ROLE_CHANGE',
  'CREATE_COMPANY',
  'UPDATE_COMPANY',
  'CREATE_BRANCH',
  'UPDATE_BRANCH',
  'DELETE_BRANCH',
  'CREATE_WAREHOUSE',
  'UPDATE_WAREHOUSE',
  'DELETE_WAREHOUSE',
  'CREATE_CUSTOMER',
  'UPDATE_CUSTOMER',
  'DELETE_CUSTOMER',
  'CREATE_SUPPLIER',
  'UPDATE_SUPPLIER',
  'DELETE_SUPPLIER',
  'CREATE_CATEGORY',
  'UPDATE_CATEGORY',
  'DELETE_CATEGORY',
  'CREATE_PRODUCT',
  'UPDATE_PRODUCT',
  'DELETE_PRODUCT',
  'STOCK_ENTRY',
  'STOCK_EXIT',
  'STOCK_ADJUSTMENT',
  'STOCK_RETURN',
  'CREATE_SALE',
  'CONFIRM_SALE',
  'COMPLETE_SALE',
  'CANCEL_SALE',
  'CREATE_PURCHASE',
  'CONFIRM_PURCHASE',
  'RECEIVE_PURCHASE',
  'CANCEL_PURCHASE',
  'UPDATE_SETTINGS',
  'EXPORT_REPORT',
] as const;

/** Módulos presentes en la bitácora (filtro de Auditoría y Reportes). */
export const AUDIT_MODULES = [
  'auth',
  'users',
  'roles',
  'companies',
  'branches',
  'warehouses',
  'customers',
  'suppliers',
  'categories',
  'products',
  'inventory',
  'sales',
  'purchases',
  'settings',
  'reports',
];

/** Tono por familia de módulo para la columna "acción" de auditoría. */
export function auditActionTone(action: string): BadgeTone {
  if (action.startsWith('LOGIN') || action === 'LOGOUT') return 'info';
  if (action.startsWith('DELETE') || action.startsWith('DEACTIVATE') || action.startsWith('CANCEL')) {
    return 'danger';
  }
  if (action.startsWith('CREATE')) return 'success';
  if (action.startsWith('UPDATE') || action.startsWith('CONFIRM') || action.startsWith('COMPLETE')) {
    return 'warning';
  }
  return 'neutral';
}
