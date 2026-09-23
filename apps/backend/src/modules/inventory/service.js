'use strict';

const { StockBalance, StockMovement } = require('./model');
const Product = require('../products/model');
const Warehouse = require('../warehouses/model');
const Notification = require('../notifications/model');
const { getForCompany } = require('../settings/service');
const { withTransaction } = require('../../config/db');
const { recordAudit, requestMeta } = require('../audit/service');
const { ValidationError, NotFoundError, ConflictError } = require('../../utils/errors');
const { getPagination, paginated } = require('../../utils/pagination');
const { escapeRegex } = require('../../utils/regex');
const { MOVEMENT_PERMISSION, MOVEMENT_AUDIT_ACTION } = require('../../config/constants');

const round2 = (n) => Math.round(n * 100) / 100;

/** Aviso de cruce a la mínima (una vez por cada cruce, no en cada salida). */
async function notifyLowStock(product, newQuantity, companyId) {
  try {
    if (!product.stockMin || product.stockMin <= 0) return;
    if (newQuantity > product.stockMin) return;
    await Notification.create({
      companyId,
      type: 'LOW_STOCK',
      title: 'Stock bajo',
      message: `${product.name} (${product.sku}) está con ${newQuantity} u. — mínimo ${product.stockMin}`,
      productId: product._id,
      // Sin session: un fallo al avisar NUNCA debe revertir la operación.
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[inventory] No se pudo crear notificación: ${err.message}`);
  }
}

/**
 * NÚCLEO DEL INVENTARIO — aplica un movimiento de forma atómica:
 *   balance (upsert condicionado) + movimiento con prev/new + aviso stock bajo.
 *
 * Reglas:
 *  - ENTRY/RETURN  → quantity se SUMA ($inc atómico).
 *  - EXIT          → quantity se RESTA con condición $gte (sin permitir
 *                    negativos salvo allowNegativeStock); si no hay stock → 409.
 *  - ADJUSTMENT    → quantity es la NUEVA EXISTENCIA ABSOLUTA (conteo físico).
 *  - Devuelve { movement, previousQuantity, newQuantity, product }.
 *  - NO escribe auditoría: lo decide cada servicio llamante (venta, compra,
 *    movimiento manual) para no duplicar registros.
 */
async function applyMovement(params, session = null) {
  const {
    companyId,
    productId,
    warehouseId,
    type,
    quantity,
    referenceType = null,
    referenceId = null,
    userId,
    reason = null,
    allowNegative = false,
  } = params;

  if (!['ENTRY', 'EXIT', 'ADJUSTMENT', 'RETURN'].includes(type)) {
    throw new ValidationError('Tipo de movimiento no válido', [
      { field: 'type', message: 'Debe ser ENTRY, EXIT, ADJUSTMENT o RETURN' },
    ]);
  }
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
    throw new ValidationError('La cantidad debe ser un número');
  }
  if (type === 'ADJUSTMENT' && quantity < 0) {
    throw new ValidationError('La existencia ajustada no puede ser negativa');
  }
  if (type !== 'ADJUSTMENT' && quantity <= 0) {
    throw new ValidationError('La cantidad debe ser mayor que 0');
  }

  // Producto y almacén deben existir dentro de la empresa (defensa en profundidad).
  let productQuery = Product.findOne({ _id: productId, companyId });
  let warehouseQuery = Warehouse.findOne({ _id: warehouseId, companyId });
  if (session) {
    productQuery = productQuery.session(session);
    warehouseQuery = warehouseQuery.session(session);
  }
  const [product, warehouse] = await Promise.all([productQuery, warehouseQuery]);
  if (!product) throw new NotFoundError('Producto no encontrado');
  if (!warehouse) throw new NotFoundError('Almacén no encontrado');

  const filter = { companyId, productId, warehouseId };
  const opts = { new: true };
  if (session) opts.session = session;

  let balance;
  let previousQuantity;
  let newQuantity;

  if (type === 'ENTRY' || type === 'RETURN') {
    balance = await StockBalance.findOneAndUpdate(
      filter,
      { $inc: { quantity } },
      { ...opts, upsert: true }
    );
    previousQuantity = round2(balance.quantity - quantity);
    newQuantity = round2(balance.quantity);
  } else if (type === 'EXIT') {
    if (allowNegative) {
      balance = await StockBalance.findOneAndUpdate(
        filter,
        { $inc: { quantity: -quantity } },
        { ...opts, upsert: true }
      );
    } else {
      balance = await StockBalance.findOneAndUpdate(
        { ...filter, quantity: { $gte: quantity } },
        { $inc: { quantity: -quantity } },
        opts
      );
      if (!balance) {
        const current = await StockBalance.findOne(filter)
          .session(session || undefined)
          .lean();
        const available = current ? current.quantity : 0;
        throw new ConflictError(
          `Stock insuficiente para "${product.name}": disponible ${available}, solicitado ${quantity}`
        );
      }
    }
    previousQuantity = round2(balance.quantity + quantity);
    newQuantity = round2(balance.quantity);
  } else {
    // ADJUSTMENT: quantity = nueva existencia absoluta (atomicidad vía pre-imagen).
    let old = null;
    try {
      old = await StockBalance.findOneAndUpdate(
        filter,
        { $set: { quantity } },
        { new: false, upsert: true, ...(session && { session }) }
      );
      if (old === null) {
        // upsert insertó un documento nuevo → la existencia anterior era 0.
        previousQuantity = 0;
      } else {
        previousQuantity = old.quantity;
      }
    } catch (err) {
      if (err.code === 11000) {
        // Carrera de dos ajustes simultáneos sobre fila inexistente → reintentar.
        old = await StockBalance.findOneAndUpdate(
          filter,
          { $set: { quantity } },
          { new: false, ...(session && { session }) }
        );
        if (old) previousQuantity = old.quantity;
        else previousQuantity = 0;
      } else {
        throw err;
      }
    }
    newQuantity = quantity;
    balance = await StockBalance.findOne(filter).session(session || undefined);
  }

  const movement = await StockMovement.create(
    [
      {
        productId,
        warehouseId,
        type,
        quantity: type === 'ADJUSTMENT' ? newQuantity : quantity,
        previousQuantity,
        newQuantity,
        referenceType,
        referenceId: referenceId ? String(referenceId) : null,
        userId,
        reason,
        companyId,
      },
    ],
    session ? { session } : {}
  );

  await notifyLowStock(product, newQuantity, companyId);

  return {
    movement: movement[0],
    balance,
    product,
    warehouse,
    previousQuantity,
    newQuantity,
  };
}

/* --------------------------- Listados (lectura) --------------------------- */

/**
 * GET /inventory — balances paginados con producto y almacén poblados.
 * lowStock=true filtra filas cuya cantidad <= stockMin del producto.
 */
async function listBalances(actor, query = {}) {
  const { page, limit, skip } = getPagination(query, { defaultLimit: 20, maxLimit: 100 });

  const match = { companyId: actor.companyId };
  if (query.warehouseId) match.warehouseId = require('mongoose').Types.ObjectId.createFromHexString(query.warehouseId);
  if (query.productId) match.productId = require('mongoose').Types.ObjectId.createFromHexString(query.productId);

  const pipeline = [{ $match: match }];

  if (query.q) {
    pipeline.push({ $lookup: { from: 'products', localField: 'productId', foreignField: '_id', as: 'product' } });
    pipeline.push({ $unwind: '$product' });
    const rx = new RegExp(escapeRegex(query.q), 'i');
    pipeline.push({ $match: { $or: [{ 'product.name': rx }, { 'product.sku': rx }] } });
  }

  pipeline.push({ $lookup: { from: 'products', localField: 'productId', foreignField: '_id', as: 'product' } });
  pipeline.push({ $unwind: { path: '$product', preserveNullAndEmptyArrays: false } });
  pipeline.push({ $lookup: { from: 'warehouses', localField: 'warehouseId', foreignField: '_id', as: 'warehouse' } });
  pipeline.push({ $unwind: { path: '$warehouse', preserveNullAndEmptyArrays: false } });

  if (query.lowStock) {
    pipeline.push({ $match: { $expr: { $lte: ['$quantity', '$product.stockMin'] } } });
  }

  const sortField = query.sort || 'name';
  const sortMap = { name: 'product.name', sku: 'product.sku', quantity: 'quantity', createdAt: 'createdAt' };
  const sortKey = sortMap[sortField] || 'product.name';
  pipeline.push({ $sort: { [sortKey]: query.sort && String(query.sort).startsWith('-') ? -1 : 1 } });

  pipeline.push({
    $facet: {
      meta: [{ $count: 'total' }],
      items: [
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            quantity: 1,
            productId: 1,
            warehouseId: 1,
            createdAt: 1,
            'product.sku': 1,
            'product.name': 1,
            'product.unit': 1,
            'product.stockMin': 1,
            'product.status': 1,
            'warehouse.name': 1,
          },
        },
      ],
    },
  });

  const [result] = await StockBalance.aggregate(pipeline);
  const total = result.meta[0] ? result.meta[0].total : 0;
  return paginated(result.items, { page, limit }, total);
}

/** GET /inventory/movements — historial completo con filtros. */
async function listMovements(actor, query = {}) {
  const { page, limit, skip } = getPagination(query, { defaultLimit: 20, maxLimit: 100 });

  const filter = { companyId: actor.companyId };
  if (query.productId) filter.productId = query.productId;
  if (query.warehouseId) filter.warehouseId = query.warehouseId;
  if (query.type) filter.type = query.type;
  if (query.userId) filter.userId = query.userId;
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = startOfDay(query.dateFrom);
    if (query.dateTo) filter.createdAt.$lte = endOfDay(query.dateTo);
  }

  const [items, total] = await Promise.all([
    StockMovement.find(filter)
      .populate('productId', 'sku name unit')
      .populate('warehouseId', 'name')
      .populate('userId', 'firstName lastName')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .lean(),
    StockMovement.countDocuments(filter),
  ]);
  return paginated(items, { page, limit }, total);
}

function startOfDay(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfDay(value) {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Movimiento manual (entrada/salida/ajuste/devolución):
 * validación de permiso por tipo + transacción + auditoría STOCK_*.
 */
async function createManualMovement(actor, body, req) {
  const permission = MOVEMENT_PERMISSION[body.type];
  if (!permission) {
    throw new ValidationError('Tipo de movimiento no permitido');
  }

  const settings = await getForCompany(actor.companyId);
  const allowNegative = Boolean(settings.allowNegativeStock) && body.type === 'EXIT';

  return withTransaction(async (session) => {
    const { movement, newQuantity } = await applyMovement(
      {
        companyId: actor.companyId,
        productId: body.productId,
        warehouseId: body.warehouseId,
        type: body.type,
        quantity: body.quantity,
        referenceType: 'MANUAL',
        referenceId: null,
        userId: actor.id,
        reason: body.reason || 'Movimiento manual',
        allowNegative,
      },
      session
    );

    await recordAudit(
      {
        userId: actor.id,
        companyId: actor.companyId,
        action: MOVEMENT_AUDIT_ACTION[body.type],
        module: 'inventory',
        entity: 'stockMovement',
        entityId: movement._id,
        newValue: {
          type: body.type,
          productId: body.productId,
          warehouseId: body.warehouseId,
          quantity: body.type === 'ADJUSTMENT' ? newQuantity : body.quantity,
          previousQuantity: movement.previousQuantity,
          newQuantity: movement.newQuantity,
        },
        description: `${body.type} manual — existencia ${movement.previousQuantity} → ${movement.newQuantity}`,
        ...requestMeta(req),
      },
      { session, strict: Boolean(session) }
    );

    return movement;
  });
}

module.exports = {
  applyMovement,
  listBalances,
  listMovements,
  createManualMovement,
  round2,
};
