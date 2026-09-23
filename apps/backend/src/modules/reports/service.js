'use strict';

const Sale = require('../sales/model');
const Purchase = require('../purchases/model');
const Product = require('../products/model');
const Customer = require('../customers/model');
const Supplier = require('../suppliers/model');
const { StockBalance, StockMovement } = require('../inventory/model');
const { buildAuditFilter } = require('../audit/service');
const AuditLog = require('../audit/model');
const { assertPermission } = require('../../utils/assertPermission');
const { auditFromReq } = require('../audit/service');
const { sendSuccess } = require('../../utils/response');
const { toCsv } = require('../../utils/csv');
const { ValidationError } = require('../../utils/errors');

/** Límite de filas por reporte (evita consultas descontroladas). */
const REPORT_LIMIT = 5000;
const round2 = (n) => Math.round(n * 100) / 100;

function dateRange(query) {
  const range = {};
  if (query.dateFrom) {
    const d = new Date(query.dateFrom);
    d.setHours(0, 0, 0, 0);
    range.$gte = d;
  }
  if (query.dateTo) {
    const d = new Date(query.dateTo);
    d.setHours(23, 59, 59, 999);
    range.$lte = d;
  }
  return Object.keys(range).length ? range : null;
}

const fmtDate = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) : '');

/* ------------------------------- FETCHERS ------------------------------- */

async function fetchSales(actor, query) {
  const filter = { companyId: actor.companyId };
  if (query.status) filter.status = query.status;
  if (query.warehouseId) filter.warehouseId = query.warehouseId;
  if (query.userId) filter.createdBy = query.userId;
  const range = dateRange(query);
  if (range) filter.createdAt = range;

  const docs = await Sale.find(filter)
    .populate('customerId', 'name customerCode')
    .populate('warehouseId', 'name')
    .populate('createdBy', 'firstName lastName')
    .sort('-createdAt')
    .limit(REPORT_LIMIT)
    .lean();

  return docs.map((s) => ({
    fecha: fmtDate(s.createdAt),
    codigo: s.customerId ? s.customerId.customerCode : '',
    cliente: s.customerId ? s.customerId.name : '',
    estado: s.status,
    almacen: s.warehouseId ? s.warehouseId.name : '',
    lineas: s.items.length,
    subtotal: s.subtotal,
    impuestos: s.tax,
    total: s.total,
    usuario: s.createdBy ? `${s.createdBy.firstName} ${s.createdBy.lastName}` : '',
    observaciones: s.notes || '',
  }));
}

async function fetchPurchases(actor, query) {
  const filter = { companyId: actor.companyId };
  if (query.status) filter.status = query.status;
  if (query.warehouseId) filter.warehouseId = query.warehouseId;
  if (query.userId) filter.createdBy = query.userId;
  const range = dateRange(query);
  if (range) filter.createdAt = range;

  const docs = await Purchase.find(filter)
    .populate('supplierId', 'name supplierCode')
    .populate('warehouseId', 'name')
    .populate('createdBy', 'firstName lastName')
    .sort('-createdAt')
    .limit(REPORT_LIMIT)
    .lean();

  return docs.map((p) => ({
    fecha: fmtDate(p.createdAt),
    codigo: p.supplierId ? p.supplierId.supplierCode : '',
    proveedor: p.supplierId ? p.supplierId.name : '',
    estado: p.status,
    recibida: fmtDate(p.receivedAt),
    almacen: p.warehouseId ? p.warehouseId.name : '',
    lineas: p.items.length,
    subtotal: p.subtotal,
    impuestos: p.tax,
    total: p.total,
    usuario: p.createdBy ? `${p.createdBy.firstName} ${p.createdBy.lastName}` : '',
  }));
}

async function fetchInventory(actor, query) {
  const filter = { companyId: actor.companyId };
  if (query.warehouseId) filter.warehouseId = query.warehouseId;

  const docs = await StockBalance.find(filter)
    .populate('productId', 'sku name unit stockMin status')
    .populate('warehouseId', 'name')
    .sort('productId')
    .limit(REPORT_LIMIT)
    .lean();

  return docs.map((b) => ({
    sku: b.productId ? b.productId.sku : '',
    producto: b.productId ? b.productId.name : '',
    unidad: b.productId ? b.productId.unit : '',
    almacen: b.warehouseId ? b.warehouseId.name : '',
    stockMin: b.productId ? b.productId.stockMin : '',
    existencia: b.quantity,
    estadoProducto: b.productId ? b.productId.status : '',
  }));
}

async function fetchMovements(actor, query) {
  const filter = { companyId: actor.companyId };
  if (query.type) filter.type = query.type;
  if (query.warehouseId) filter.warehouseId = query.warehouseId;
  if (query.productId) filter.productId = query.productId;
  if (query.userId) filter.userId = query.userId;
  const range = dateRange(query);
  if (range) filter.createdAt = range;

  const docs = await StockMovement.find(filter)
    .populate('productId', 'sku name')
    .populate('warehouseId', 'name')
    .populate('userId', 'firstName lastName')
    .sort('-createdAt')
    .limit(REPORT_LIMIT)
    .lean();

  return docs.map((m) => ({
    fecha: fmtDate(m.createdAt),
    tipo: m.type,
    sku: m.productId ? m.productId.sku : '',
    producto: m.productId ? m.productId.name : '',
    almacen: m.warehouseId ? m.warehouseId.name : '',
    cantidad: m.quantity,
    anterior: m.previousQuantity,
    nueva: m.newQuantity,
    referencia: m.referenceType || '',
    usuario: m.userId ? `${m.userId.firstName} ${m.userId.lastName}` : '',
    motivo: m.reason || '',
  }));
}

async function fetchProducts(actor, query) {
  const filter = { companyId: actor.companyId };
  if (query.status) filter.status = query.status;
  if (query.categoryId) filter.categoryId = query.categoryId;
  if (query.supplierId) filter.supplierId = query.supplierId;

  const docs = await Product.find(filter)
    .populate('categoryId', 'name')
    .populate('supplierId', 'name')
    .sort('sku')
    .limit(REPORT_LIMIT)
    .lean();

  return docs.map((p) => ({
    sku: p.sku,
    nombre: p.name,
    categoria: p.categoryId ? p.categoryId.name : '',
    proveedor: p.supplierId ? p.supplierId.name : '',
    precioCompra: p.purchasePrice,
    precioVenta: p.salePrice,
    stockMin: p.stockMin,
    unidad: p.unit,
    estado: p.status,
  }));
}

async function fetchCustomers(actor, query) {
  const filter = { companyId: actor.companyId };
  if (query.status) filter.status = query.status;
  const docs = await Customer.find(filter).sort('customerCode').limit(REPORT_LIMIT).lean();
  return docs.map((c) => ({
    codigo: c.customerCode,
    nombre: c.name,
    empresa: c.companyName || '',
    email: c.email || '',
    telefono: c.phone || '',
    direccion: c.address || '',
    estado: c.status,
    creado: fmtDate(c.createdAt),
  }));
}

async function fetchSuppliers(actor, query) {
  const filter = { companyId: actor.companyId };
  if (query.status) filter.status = query.status;
  const docs = await Supplier.find(filter).sort('supplierCode').limit(REPORT_LIMIT).lean();
  return docs.map((s) => ({
    codigo: s.supplierCode,
    nombre: s.name,
    empresa: s.companyName || '',
    email: s.email || '',
    telefono: s.phone || '',
    direccion: s.address || '',
    estado: s.status,
    creado: fmtDate(s.createdAt),
  }));
}

async function fetchAudit(actor, query) {
  const filter = buildAuditFilter(actor, query);
  const docs = await AuditLog.find(filter)
    .populate('userId', 'firstName lastName email')
    .sort('-createdAt')
    .limit(REPORT_LIMIT)
    .lean();
  return docs.map((a) => ({
    fecha: fmtDate(a.createdAt),
    accion: a.action,
    modulo: a.module,
    entidad: a.entity || '',
    idEntidad: a.entityId || '',
    usuario: a.userId ? `${a.userId.firstName} ${a.userId.lastName}` : 'sistema',
    descripcion: a.description || '',
    ip: a.ip || '',
  }));
}

/* ------------------------------ RUNNER común ----------------------------- */

/**
 * Ejecuta un reporte con formato JSON (por defecto) o CSV.
 * El CSV exige además el permiso reports.export y deja rastro EXPORT_REPORT.
 */
async function runReport(req, res, { name, schema, fetch }) {
  if (req.query.format === 'csv') {
    assertPermission(req, 'reports.export');
  }

  const rows = await fetch(req.user, req.query);

  if (req.query.format === 'csv') {
    await auditFromReq(req, {
      action: 'EXPORT_REPORT',
      module: 'reports',
      entity: 'report',
      entityId: name,
      description: `Exportación CSV del reporte ${name} (${rows.length} filas)`,
    });
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-${name}-${stamp}.csv"`);
    return res.send(toCsv(rows));
  }

  if (!Array.isArray(rows)) {
    throw new ValidationError('No se pudieron generar las filas del reporte');
  }
  return sendSuccess(res, { report: name, count: rows.length, rows });
}

module.exports = {
  runReport,
  fetchSales,
  fetchPurchases,
  fetchInventory,
  fetchMovements,
  fetchProducts,
  fetchCustomers,
  fetchSuppliers,
  fetchAudit,
  REPORT_LIMIT,
};
