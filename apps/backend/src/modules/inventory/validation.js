'use strict';

const { MOVEMENT_TYPES, STATUSES } = require('../../config/constants');

/** GET /inventory — balances por almacén. */
const balanceListSchema = {
  page: { type: 'integer', min: 1 },
  limit: { type: 'integer', min: 1, max: 100 },
  sort: {
    type: 'enum',
    enum: ['name', '-name', 'sku', '-sku', 'quantity', '-quantity', 'createdAt', '-createdAt'],
  },
  q: { type: 'string', maxLength: 80 },
  warehouseId: { type: 'objectId' },
  productId: { type: 'objectId' },
  lowStock: { type: 'boolean' },
};

/** GET /inventory/movements — historial. */
const movementListSchema = {
  page: { type: 'integer', min: 1 },
  limit: { type: 'integer', min: 1, max: 100 },
  productId: { type: 'objectId' },
  warehouseId: { type: 'objectId' },
  type: { type: 'enum', enum: MOVEMENT_TYPES },
  userId: { type: 'objectId' },
  dateFrom: { type: 'date' },
  dateTo: { type: 'date' },
};

/** POST /inventory/movements — movimiento manual. */
const movementCreateSchema = {
  productId: { required: true, type: 'objectId' },
  warehouseId: { required: true, type: 'objectId' },
  type: { required: true, type: 'enum', enum: MOVEMENT_TYPES },
  quantity: { required: true, type: 'number', min: 0 },
  reason: { type: 'string', maxLength: 200 },
};

module.exports = { balanceListSchema, movementListSchema, movementCreateSchema };
