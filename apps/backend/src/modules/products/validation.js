'use strict';

const { STATUSES, UNITS } = require('../../config/constants');

const statusEnum = { type: 'enum', enum: STATUSES };
const unitEnum = { type: 'enum', enum: UNITS };

/** GET /products — paginación, búsqueda y filtros. */
const productListSchema = {
  page: { type: 'integer', min: 1 },
  limit: { type: 'integer', min: 1, max: 100 },
  sort: { type: 'string', maxLength: 40 },
  q: { type: 'string', maxLength: 80 },
  status: statusEnum,
  categoryId: { type: 'objectId' },
  supplierId: { type: 'objectId' },
};

/** POST /products */
const productCreateSchema = {
  sku: { required: true, type: 'string', minLength: 1, maxLength: 40 },
  name: { required: true, type: 'string', minLength: 2, maxLength: 120 },
  description: { type: 'string', maxLength: 500 },
  categoryId: { required: true, type: 'objectId' },
  supplierId: { type: 'objectId' },
  purchasePrice: { required: true, type: 'number', min: 0 },
  salePrice: { required: true, type: 'number', min: 0 },
  stockMin: { type: 'number', min: 0 },
  unit: unitEnum,
  status: statusEnum,
};

/** PATCH /products/:id — todos opcionales. */
const productUpdateSchema = {
  sku: { type: 'string', minLength: 1, maxLength: 40 },
  name: { type: 'string', minLength: 2, maxLength: 120 },
  description: { type: 'string', maxLength: 500 },
  categoryId: { type: 'objectId' },
  supplierId: { type: 'objectId' },
  purchasePrice: { type: 'number', min: 0 },
  salePrice: { type: 'number', min: 0 },
  stockMin: { type: 'number', min: 0 },
  unit: unitEnum,
  status: statusEnum,
};

module.exports = { productListSchema, productCreateSchema, productUpdateSchema };
