'use strict';

const Sale = require('./model');
const Product = require('../products/model');
const Customer = require('../customers/model');
const Warehouse = require('../warehouses/model');
const { getForCompany } = require('../settings/service');
const { applyMovement, round2 } = require('../inventory/service');
const { withTransaction } = require('../../config/db');
const { recordAudit, requestMeta } = require('../audit/service');
const { ValidationError, NotFoundError, ConflictError } = require('../../utils/errors');
const { getPagination, getSort, paginated } = require('../../utils/pagination');

/**
 * FLUJO C — Venta:
 * crear (DRAFT) → confirmar (valida stock y descuenta + movimiento + auditoría)
 * → completar → dashboard. Cancelar revierte el inventario si se había descontado.
 */

/** Resuelve y snapshota los items; calcula subtotal. Atómico si hay session. */
async function resolveItems(actor, rawItems, session) {
  const ids = [...new Set(rawItems.map((i) => i.productId))];
  if (ids.length !== rawItems.length) {
    throw new ValidationError('Producto repetido en la lista', [
      { field: 'items', message: 'Cada producto aparece más de una vez; una línea por producto' },
    ]);
  }

  let query = Product.find({ _id: { $in: ids }, companyId: actor.companyId, status: 'active' });
  if (session) query = query.session(session);
  const products = await query.lean();

  const byId = new Map(products.map((p) => [String(p._id), p]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) {
    throw new NotFoundError(`Productos no encontrados o inactivos: ${missing.join(', ')}`);
  }

  const items = rawItems.map((i) => {
    const product = byId.get(i.productId);
    if (!(i.quantity > 0)) {
      throw new ValidationError('Cantidad inválida', [
        { field: 'items', message: `La cantidad de "${product.name}" debe ser mayor que 0` },
      ]);
    }
    return {
      productId: product._id,
      sku: product.sku,
      name: product.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      subtotal: round2(i.quantity * i.unitPrice),
    };
  });

  return { items, subtotal: round2(items.reduce((sum, it) => sum + it.subtotal, 0)) };
}

async function assertActive(model, id, companyId, session, label) {
  let query = model.findOne({ _id: id, companyId, status: 'active' });
  if (session) query = query.session(session);
  const doc = await query;
  if (!doc) throw new NotFoundError(`${label} no encontrado o inactivo`);
  return doc;
}

/** Totales SIEMPRE calculados en servidor con el taxRate de la empresa. */
async function computeTotals(companyId, subtotal, session) {
  const settings = await getForCompany(companyId, session);
  const tax = round2(subtotal * (settings.taxRate || 0));
  return { tax, total: round2(subtotal + tax) };
}

async function create(actor, body, req) {
  return withTransaction(async (session) => {
    const { items, subtotal } = await resolveItems(actor, body.items, session);
    await assertActive(Customer, body.customerId, actor.companyId, session, 'Cliente');
    await assertActive(Warehouse, body.warehouseId, actor.companyId, session, 'Almacén');
    const { tax, total } = await computeTotals(actor.companyId, subtotal, session);

    const [sale] = await Sale.create(
      [
        {
          customerId: body.customerId,
          warehouseId: body.warehouseId,
          companyId: actor.companyId,
          createdBy: actor.id,
          items,
          subtotal,
          tax,
          total,
          notes: body.notes,
          status: 'DRAFT',
        },
      ],
      session ? { session } : {}
    );

    await recordAudit(
      {
        userId: actor.id,
        companyId: actor.companyId,
        action: 'CREATE_SALE',
        module: 'sales',
        entity: 'sale',
        entityId: sale._id,
        newValue: { status: 'DRAFT', total, customerId: String(body.customerId), lines: items.length },
        description: `Venta borrador creada — ${items.length} línea(s), total ${total}`,
        ...requestMeta(req),
      },
      { session, strict: Boolean(session) }
    );
    return sale;
  });
}

async function list(actor, query = {}) {
  const { page, limit, skip } = getPagination(query, { defaultLimit: 20, maxLimit: 100 });
  const sort = getSort(query, ['createdAt', 'total'], '-createdAt');

  const filter = { companyId: actor.companyId };
  if (query.status) filter.status = query.status;
  if (query.customerId) filter.customerId = query.customerId;
  if (query.warehouseId) filter.warehouseId = query.warehouseId;
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) {
      const d = new Date(query.dateFrom);
      d.setHours(0, 0, 0, 0);
      filter.createdAt.$gte = d;
    }
    if (query.dateTo) {
      const d = new Date(query.dateTo);
      d.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = d;
    }
  }

  const [items, total] = await Promise.all([
    Sale.find(filter)
      .populate('customerId', 'name customerCode companyName')
      .populate('warehouseId', 'name')
      .populate('createdBy', 'firstName lastName')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Sale.countDocuments(filter),
  ]);
  return paginated(items, { page, limit }, total);
}

async function get(actor, id) {
  const sale = await Sale.findOne({ _id: id, companyId: actor.companyId })
    .populate('customerId', 'name customerCode companyName email phone')
    .populate('warehouseId', 'name')
    .populate('createdBy', 'firstName lastName')
    .populate('cancelledBy', 'firstName lastName');
  if (!sale) throw new NotFoundError('Venta no encontrada');
  return sale;
}

/** CONFIRMACIÓN: valida stock → descuenta → movimiento → auditoría (transaccional). */
async function confirm(actor, id, req) {
  return withTransaction(async (session) => {
    const sale = await Sale.findOne({ _id: id, companyId: actor.companyId }).session(session);
    if (!sale) throw new NotFoundError('Venta no encontrada');
    if (sale.status !== 'DRAFT') {
      throw new ConflictError(`La venta no está en borrador (estado actual: ${sale.status})`);
    }

    const settings = await getForCompany(actor.companyId, session);

    for (const item of sale.items) {
      // Si faltase stock, applyMovement lanza 409 y LA TRANSACCIÓN LO REVIERTE TODO.
      await applyMovement(
        {
          companyId: actor.companyId,
          productId: item.productId,
          warehouseId: sale.warehouseId,
          type: 'EXIT',
          quantity: item.quantity,
          referenceType: 'SALE',
          referenceId: sale._id,
          userId: actor.id,
          reason: `Confirmación de venta`,
          allowNegative: Boolean(settings.allowNegativeStock),
        },
        session
      );
    }

    sale.status = 'CONFIRMED';
    sale.confirmedAt = new Date();
    await sale.save({ session });

    await recordAudit(
      {
        userId: actor.id,
        companyId: actor.companyId,
        action: 'CONFIRM_SALE',
        module: 'sales',
        entity: 'sale',
        entityId: sale._id,
        previousValue: { status: 'DRAFT' },
        newValue: { status: 'CONFIRMED', total: sale.total },
        description: `Venta confirmada: inventario descontado en ${sale.items.length} línea(s)`,
        ...requestMeta(req),
      },
      { session, strict: true }
    );
    return sale;
  });
}

/** COMPLETAR: CONFIRMED → COMPLETED (sin efecto de stock). */
async function complete(actor, id, req) {
  return withTransaction(async (session) => {
    const sale = await Sale.findOne({ _id: id, companyId: actor.companyId }).session(session);
    if (!sale) throw new NotFoundError('Venta no encontrada');
    if (sale.status !== 'CONFIRMED') {
      throw new ConflictError(`Sólo se completa una venta confirmada (estado actual: ${sale.status})`);
    }
    sale.status = 'COMPLETED';
    sale.completedAt = new Date();
    await sale.save({ session });

    await recordAudit(
      {
        userId: actor.id,
        companyId: actor.companyId,
        action: 'COMPLETE_SALE',
        module: 'sales',
        entity: 'sale',
        entityId: sale._id,
        previousValue: { status: 'CONFIRMED' },
        newValue: { status: 'COMPLETED' },
        description: 'Venta completada',
        ...requestMeta(req),
      },
      { session, strict: true }
    );
    return sale;
  });
}

/** CANCELACIÓN: estado + campos obligatorios + reversa de inventario si aplica. */
async function cancel(actor, id, cancelReason, req) {
  return withTransaction(async (session) => {
    const sale = await Sale.findOne({ _id: id, companyId: actor.companyId }).session(session);
    if (!sale) throw new NotFoundError('Venta no encontrada');
    if (sale.status === 'CANCELLED') {
      throw new ConflictError('La venta ya está cancelada');
    }

    const previousStatus = sale.status;
    const stockWasDeducted = previousStatus === 'CONFIRMED' || previousStatus === 'COMPLETED';

    if (stockWasDeducted) {
      const settings = await getForCompany(actor.companyId, session);
      for (const item of sale.items) {
        await applyMovement(
          {
            companyId: actor.companyId,
            productId: item.productId,
            warehouseId: sale.warehouseId,
            type: 'RETURN',
            quantity: item.quantity,
            referenceType: 'SALE',
            referenceId: sale._id,
            userId: actor.id,
            reason: 'Cancelación de venta (reversa)',
            allowNegative: Boolean(settings.allowNegativeStock),
          },
          session
        );
      }
    }

    sale.status = 'CANCELLED';
    sale.cancelledBy = actor.id;
    sale.cancelledAt = new Date();
    sale.cancelReason = cancelReason;
    await sale.save({ session });

    await recordAudit(
      {
        userId: actor.id,
        companyId: actor.companyId,
        action: 'CANCEL_SALE',
        module: 'sales',
        entity: 'sale',
        entityId: sale._id,
        previousValue: { status: previousStatus },
        newValue: { status: 'CANCELLED', cancelReason },
        description: `Venta cancelada: ${cancelReason}${stockWasDeducted ? ' (inventario revertido)' : ''}`,
        ...requestMeta(req),
      },
      { session, strict: true }
    );
    return sale;
  });
}

module.exports = { create, list, get, confirm, complete, cancel };
