'use strict';

const { SALE_STATUS, STATUSES } = require('../../config/constants');

/** GET /sales — listado con filtros. */
const saleListSchema = {
  page: { type: 'integer', min: 1 },
  limit: { type: 'integer', min: 1, max: 100 },
  sort: { type: 'enum', enum: ['-createdAt', 'createdAt', '-total', 'total'] },
  status: { type: 'enum', enum: SALE_STATUS },
  customerId: { type: 'objectId' },
  warehouseId: { type: 'objectId' },
  dateFrom: { type: 'date' },
  dateTo: { type: 'date' },
};

/**
 * POST /sales — creación de borrador.
 * Sólo llegan productId/cantidad/precio unitario: sku, nombre y subtotales
 * los calcula el servidor (snapshot + totales nunca se confían al cliente).
 */
const saleCreateSchema = {
  customerId: { required: true, type: 'objectId' },
  warehouseId: { required: true, type: 'objectId' },
  notes: { type: 'string', maxLength: 300 },
  items: {
    required: true,
    type: 'array',
    minLength: 1,
    maxLength: 100,
    items: {
      type: 'object',
      schema: {
        productId: { required: true, type: 'objectId' },
        quantity: { required: true, type: 'number', min: 0 },
        unitPrice: { required: true, type: 'number', min: 0 },
      },
    },
  },
};

/** POST /sales/:id/cancel — motivo obligatorio (trazabilidad). */
const saleCancelSchema = {
  cancelReason: { required: true, type: 'string', minLength: 3, maxLength: 200 },
};

module.exports = { saleListSchema, saleCreateSchema, saleCancelSchema };
