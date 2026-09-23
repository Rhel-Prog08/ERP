'use strict';

const { PURCHASE_STATUS } = require('../../config/constants');

/** GET /purchases — listado con filtros. */
const purchaseListSchema = {
  page: { type: 'integer', min: 1 },
  limit: { type: 'integer', min: 1, max: 100 },
  sort: { type: 'enum', enum: ['-createdAt', 'createdAt', '-total', 'total'] },
  status: { type: 'enum', enum: PURCHASE_STATUS },
  supplierId: { type: 'objectId' },
  warehouseId: { type: 'objectId' },
  dateFrom: { type: 'date' },
  dateTo: { type: 'date' },
};

/** POST /purchases — borrador; totales calculados en servidor. */
const purchaseCreateSchema = {
  supplierId: { required: true, type: 'objectId' },
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

/** POST /purchases/:id/cancel — motivo obligatorio. */
const purchaseCancelSchema = {
  cancelReason: { required: true, type: 'string', minLength: 3, maxLength: 200 },
};

module.exports = { purchaseListSchema, purchaseCreateSchema, purchaseCancelSchema };
