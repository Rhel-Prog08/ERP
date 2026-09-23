'use strict';

const { STATUSES } = require('../../config/constants');

const statusEnum = { type: 'enum', enum: STATUSES };

/** GET /suppliers — paginación, búsqueda y filtros. */
const supplierListSchema = {
  page: { type: 'integer', min: 1 },
  limit: { type: 'integer', min: 1, max: 100 },
  sort: { type: 'string', maxLength: 40 },
  q: { type: 'string', maxLength: 80 },
  status: statusEnum,
};

/** POST /suppliers — supplierCode NO se acepta del cliente (lo genera el servidor). */
const supplierCreateSchema = {
  name: { required: true, type: 'string', minLength: 2, maxLength: 120 },
  companyName: { type: 'string', maxLength: 160 },
  email: { type: 'email' },
  phone: { type: 'string', maxLength: 40 },
  address: { type: 'string', maxLength: 240 },
  status: statusEnum,
};

/** PATCH /suppliers/:id — todos opcionales. */
const supplierUpdateSchema = {
  name: { type: 'string', minLength: 2, maxLength: 120 },
  companyName: { type: 'string', maxLength: 160 },
  email: { type: 'email' },
  phone: { type: 'string', maxLength: 40 },
  address: { type: 'string', maxLength: 240 },
  status: statusEnum,
};

module.exports = { supplierListSchema, supplierCreateSchema, supplierUpdateSchema };
