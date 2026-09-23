/**
 * Modelos de dominio del ERP (espejo de los documentos de Mongoose).
 * Los ObjectId viajan como string en JSON; las referencias pobladas llegan
 * como objeto con _id, así que se tipan como unión.
 */

export type Status = 'active' | 'inactive';

export type SaleStatus = 'DRAFT' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
export type PurchaseStatus = 'DRAFT' | 'CONFIRMED' | 'RECEIVED' | 'CANCELLED';
export type MovementType = 'ENTRY' | 'EXIT' | 'ADJUSTMENT' | 'RETURN';
export type Unit = 'unidad' | 'caja' | 'kilo' | 'litro' | 'metro' | 'pack';

export interface BaseDoc {
  _id: string;
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
}

/* ------------------------------- USUARIOS ------------------------------- */

export interface RoleRef {
  _id: string;
  name: string;
}

export interface User extends BaseDoc {
  firstName: string;
  lastName: string;
  email: string;
  roleId: string | RoleRef;
  status: Status;
  lastLoginAt?: string | null;
}

export interface UserCreateInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleId: string;
  status?: Status;
}

export interface UserUpdateInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  roleId?: string;
  status?: Status;
  newPassword?: string;
}

/* --------------------------------- RBAC --------------------------------- */

export interface Role extends BaseDoc {
  name: string;
  permissions: string[];
  isSystem: boolean;
  status: Status;
}

export interface Permission {
  _id?: string;
  key: string;
  module: string;
  action: string;
  description: string;
}

/* ----------------------------- ORGANIZACIÓN ----------------------------- */

export interface Company extends BaseDoc {
  name: string;
  legalName?: string;
  taxId?: string;
  phone?: string;
  email?: string;
  address?: string;
  status: Status;
}

export interface Branch extends BaseDoc {
  name: string;
  address?: string;
  phone?: string;
  status: Status;
}

export interface Warehouse extends BaseDoc {
  name: string;
  branchId: string | null;
  status: Status;
}

/* ------------------------------- MAESTROS ------------------------------- */

export interface Customer extends BaseDoc {
  customerCode: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  status: Status;
}

export interface Supplier extends BaseDoc {
  supplierCode: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  status: Status;
}

export interface Category extends BaseDoc {
  name: string;
  description?: string;
  status: Status;
}

export interface Product extends BaseDoc {
  sku: string;
  name: string;
  description?: string;
  categoryId: string;
  supplierId: string | null;
  purchasePrice: number;
  salePrice: number;
  stockMin: number;
  unit: Unit;
  status: Status;
}

/* ------------------------------ INVENTARIO ------------------------------ */

export interface PopulatedProductBrief {
  _id?: string;
  sku: string;
  name: string;
  unit?: Unit;
  stockMin?: number;
  status?: Status;
}

/** Fila de GET /inventory (agregación con producto y almacén poblados). */
export interface Balance extends BaseDoc {
  quantity: number;
  productId: string | PopulatedProductBrief;
  warehouseId: string;
  product: PopulatedProductBrief;
  warehouse: { _id?: string; name: string };
}

export interface PopulatedRef {
  _id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  sku?: string;
}

export interface Movement extends BaseDoc {
  productId: string | PopulatedRef;
  warehouseId: string | PopulatedRef;
  userId: string | PopulatedRef;
  type: MovementType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  referenceType?: string | null;
  referenceId?: string | null;
  reason?: string | null;
}

export interface MovementInput {
  productId: string;
  warehouseId: string;
  type: MovementType;
  quantity: number;
  reason?: string;
}

/* --------------------------- VENTAS / COMPRAS --------------------------- */

export interface DocumentItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface DocumentInputItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface SaleItemLine extends DocumentInputItem {
  /** Sólo en el cliente, para el cálculo previo al envío. */
  _key?: string;
}

export interface CustomerRef {
  _id: string;
  name: string;
  customerCode?: string;
  companyName?: string;
  email?: string;
  phone?: string;
}

export interface SupplierRef {
  _id: string;
  name: string;
  supplierCode?: string;
  companyName?: string;
  email?: string;
  phone?: string;
}

export interface UserRef {
  _id: string;
  firstName?: string;
  lastName?: string;
}

export interface Sale extends BaseDoc {
  customerId: string | CustomerRef;
  warehouseId: string | PopulatedRef;
  createdBy: string | UserRef;
  cancelledBy?: string | UserRef | null;
  items: DocumentItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: SaleStatus;
  notes?: string;
  confirmedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface Purchase extends BaseDoc {
  supplierId: string | SupplierRef;
  warehouseId: string | PopulatedRef;
  createdBy: string | UserRef;
  cancelledBy?: string | UserRef | null;
  items: DocumentItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: PurchaseStatus;
  notes?: string;
  confirmedAt?: string;
  receivedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface DocumentCreateInput {
  customerId?: string;
  supplierId?: string;
  warehouseId: string;
  items: DocumentInputItem[];
  notes?: string;
}

/* -------------------------- DASHBOARD / VARIOS -------------------------- */

export interface DashboardKpi {
  salesToday: number;
  salesTodayCount: number;
  salesMonth: number;
  salesMonthCount: number;
  purchasesMonth: number;
  purchasesMonthCount: number;
  totalProducts: number;
  lowStockCount: number;
  totalCustomers: number;
  totalSuppliers: number;
}

export interface DashboardRecentSale {
  _id: string;
  customerId: string | CustomerRef | null;
  warehouseId?: string | PopulatedRef;
  total: number;
  status: SaleStatus;
  createdAt: string;
}

export interface DashboardRecentPurchase {
  _id: string;
  supplierId: string | SupplierRef | null;
  warehouseId?: string | PopulatedRef;
  total: number;
  status: PurchaseStatus;
  createdAt: string;
}

export interface LowStockItem {
  sku: string;
  name: string;
  stockMin: number;
  totalStock: number;
  unit?: Unit;
}

export interface SalesPoint {
  date: string;
  total: number;
  count: number;
}

export interface TopProduct {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface Dashboard {
  kpi: DashboardKpi;
  recentSales: DashboardRecentSale[];
  recentPurchases: DashboardRecentPurchase[];
  lowStock: LowStockItem[];
  salesByPeriod: SalesPoint[];
  topProducts: TopProduct[];
}

export interface Notification extends BaseDoc {
  type: 'LOW_STOCK';
  title: string;
  message?: string;
  productId?: string | null;
  read: boolean;
}

export interface AuditLog extends BaseDoc {
  userId: string | (UserRef & { email?: string }) | null;
  action: string;
  module: string;
  entity?: string;
  entityId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  description?: string;
  ip?: string;
  userAgent?: string;
}

export interface Settings {
  id: string;
  companyId: string;
  taxRate: number;
  allowNegativeStock: boolean;
  updatedAt?: string;
}

/** Fila de reporte: claves dinámicas según el informe. */
export type ReportRow = Record<string, string | number>;

export type ReportKey =
  | 'sales'
  | 'purchases'
  | 'inventory'
  | 'movements'
  | 'products'
  | 'customers'
  | 'suppliers'
  | 'audit';

export interface ReportResult {
  report: ReportKey;
  count: number;
  rows: ReportRow[];
}
