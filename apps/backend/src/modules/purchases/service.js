'use strict';

const Purchase = require('./model');
const Product = require('../products/model');
const Supplier = require('../suppliers/model');
const Warehouse = require('../warehouses/model');
const { getForCompany } = require('../settings/service');
const { applyMovement, round2 } = require('../inventory/service');
const { withTransaction } = require('../../config/db');
const { recordAudit, requestMeta } = require('../audit/service');
const { ValidationError, NotFoundError, ConflictError } = require('../../utils/errors');
const { getPagination, getSort, paginated } = require('../../utils/pagination');

/**
 * FLUJO B — Compra:
 * crear (DRAFT) → confirmar (CONFIRMED) → recibir (RECEIVED: inventario SUMA
 * + movimiento ENTRY + update purchasePrice + auditoría) → dashboard.
 * Cancelar una compra recibida revierte el inventario con EXIT.
 */

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

async function computeTotals(companyId, subtotal, session) {
  const settings = await getForCompany(companyId, session);
  const tax = round2(subtotal * (settings.taxRate || 0));
  return { tax, total: round2(subtotal + tax) };
}

async function create(actor, body, req) {
  return withTransaction(async (session) => {
    const { items, subtotal } = await resolveItems(actor, body.items, session);
    await assertActive(Supplier, body.supplierId, actor.companyId, session, 'Proveedor');
    await assertActive(Warehouse, body.warehouseId, actor.companyId, session, 'Almacén');
    const { tax, total } = await computeTotals(actor.companyId, subtotal, session);

    const [purchase] = await Purchase.create(
      [
        {
          supplierId: body.supplierId,
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
        action: 'CREATE_PURCHASE',
        module: 'purchases',
        entity: 'purchase',
        entityId: purchase._id,
        newValue: { status: 'DRAFT', total, supplierId: String(body.supplierId), lines: items.length },
        description: `Compra borrador creada — ${items.length} línea(s), total ${total}`,
        ...requestMeta(req),
      },
      { session, strict: Boolean(session) }
    );
    return purchase;
  });
}

async function list(actor, query = {}) {
  const { page, limit, skip } = getPagination(query, { defaultLimit: 20, maxLimit: 100 });
  const sort = getSort(query, ['createdAt', 'total'], '-createdAt');

  const filter = { companyId: actor.companyId };
  if (query.status) filter.status = query.status;
  if (query.supplierId) filter.supplierId = query.supplierId;
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
    Purchase.find(filter)
      .populate('supplierId', 'name supplierCode companyName')
      .populate('warehouseId', 'name')
      .populate('createdBy', 'firstName lastName')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Purchase.countDocuments(filter),
  ]);
  return paginated(items, { page, limit }, total);
}

async function get(actor, id) {
  const purchase = await Purchase.findOne({ _id: id, companyId: actor.companyId })
    .populate('supplierId', 'name supplierCode companyName email phone')
    .populate('warehouseId', 'name')
    .populate('createdBy', 'firstName lastName')
    .populate('cancelledBy', 'firstName lastName');
  if (!purchase) throw new NotFoundError('Compra no encontrada');
  return purchase;
}

/** DRAFT → CONFIRMED (sin efecto de stock todavía). */
async function confirm(actor, id, req) {
  return withTransaction(async (session) => {
    const purchase = await Purchase.findOne({ _id: id, companyId: actor.companyId }).session(session);
    if (!purchase) throw new NotFoundError('Compra no encontrada');
    if (purchase.status !== 'DRAFT') {
      throw new ConflictError(`La compra no está en borrador (estado actual: ${purchase.status})`);
    }
    purchase.status = 'CONFIRMED';
    purchase.confirmedAt = new Date();
    await purchase.save({ session });

    await recordAudit(
      {
        userId: actor.id,
        companyId: actor.companyId,
        action: 'CONFIRM_PURCHASE',
        module: 'purchases',
        entity: 'purchase',
        entityId: purchase._id,
        previousValue: { status: 'DRAFT' },
        newValue: { status: 'CONFIRMED', total: purchase.total },
        description: 'Compra confirmada',
        ...requestMeta(req),
      },
      { session, strict: true }
    );
    return purchase;
  });
}

/**
 * RECEPCIÓN (FLUJO B):
 * inventario + → movimiento ENTRY → product.purchasePrice = precio de compra
 * → estado RECEIVED → auditoría. Todo en UNA transacción.
 */
async function receive(actor, id, req) {
  return withTransaction(async (session) => {
    const purchase = await Purchase.findOne({ _id: id, companyId: actor.companyId }).session(session);
    if (!purchase) throw new NotFoundError('Compra no encontrada');
    if (purchase.status !== 'CONFIRMED') {
      throw new ConflictError(`Sólo se recibe una compra confirmada (estado actual: ${purchase.status})`);
    }

    for (const item of purchase.items) {
      await applyMovement(
        {
          companyId: actor.companyId,
          productId: item.productId,
          warehouseId: purchase.warehouseId,
          type: 'ENTRY',
          quantity: item.quantity,
          referenceType: 'PURCHASE',
          referenceId: purchase._id,
          userId: actor.id,
          reason: 'Recepción de compra',
        },
        session
      );

      // Integración: el coste de compra se actualiza con la última recepción.
      const product = await Product.findOne({ _id: item.productId, companyId: actor.companyId }).session(session);
      if (product) {
        product.purchasePrice = item.unitPrice;
        await product.save({ session });
      }
    }

    purchase.status = 'RECEIVED';
    purchase.receivedAt = new Date();
    await purchase.save({ session });

    await recordAudit(
      {
        userId: actor.id,
        companyId: actor.companyId,
        action: 'RECEIVE_PURCHASE',
        module: 'purchases',
        entity: 'purchase',
        entityId: purchase._id,
        previousValue: { status: 'CONFIRMED' },
        newValue: { status: 'RECEIVED', total: purchase.total },
        description: `Compra recibida: inventario incrementado en ${purchase.items.length} línea(s)`,
        ...requestMeta(req),
      },
      { session, strict: true }
    );
    return purchase;
  });
}

/**
 * CANCELACIÓN:
 *  DRAFT/CONFIRMED → sólo estado (nunca hubo efecto de stock).
 *  RECEIVED        → reversa con EXIT (respeta allowNegativeStock).
 */
async function cancel(actor, id, cancelReason, req) {
  return withTransaction(async (session) => {
    const purchase = await Purchase.findOne({ _id: id, companyId: actor.companyId }).session(session);
    if (!purchase) throw new NotFoundError('Compra no encontrada');
    if (purchase.status === 'CANCELLED') {
      throw new ConflictError('La compra ya está cancelada');
    }

    const previousStatus = purchase.status;

    if (previousStatus === 'RECEIVED') {
      const settings = await getForCompany(actor.companyId, session);
      for (const item of purchase.items) {
        await applyMovement(
          {
            companyId: actor.companyId,
            productId: item.productId,
            warehouseId: purchase.warehouseId,
            type: 'EXIT',
            quantity: item.quantity,
            referenceType: 'PURCHASE',
            referenceId: purchase._id,
            userId: actor.id,
            reason: 'Cancelación de compra (reversa)',
            allowNegative: Boolean(settings.allowNegativeStock),
          },
          session
        );
      }
    }

    purchase.status = 'CANCELLED';
    purchase.cancelledBy = actor.id;
    purchase.cancelledAt = new Date();
    purchase.cancelReason = cancelReason;
    await purchase.save({ session });

    await recordAudit(
      {
        userId: actor.id,
        companyId: actor.companyId,
        action: 'CANCEL_PURCHASE',
        module: 'purchases',
        entity: 'purchase',
        entityId: purchase._id,
        previousValue: { status: previousStatus },
        newValue: { status: 'CANCELLED', cancelReason },
        description: `Compra cancelada: ${cancelReason}${previousStatus === 'RECEIVED' ? ' (inventario revertido)' : ''}`,
        ...requestMeta(req),
      },
      { session, strict: true }
    );
    return purchase;
  });
}

module.exports = { create, list, get, confirm, receive, cancel };
