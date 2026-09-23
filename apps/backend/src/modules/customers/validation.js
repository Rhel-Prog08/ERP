'use strict';

const { STATUSES } = require('../../config/constants');

const statusEnum = { type: 'enum', enum: STATUSES };

/** GET /customers — paginación, búsqueda y filtros. */
const customerListSchema = {
  page: { type: 'integer', min: 1 },
  limit: { type: 'integer', min: 1, max: 100 },
  sort: { type: 'string', maxLength: 40 },
  q: { type: 'string', maxLength: 80 },
  status: statusEnum,
};

/** POST /customers */
const customerCreateSchema = {
  name: { required: true, type: 'string', minLength: 2, maxLength: 120 },
  companyName: { type: 'string', maxLength: 160 },
  email: { type: 'email' },
  phone: { type: 'string', maxLength: 40 },
  address: { type: 'string', maxLength: 240 },
  status: statusEnum,
};

/** PATCH /customers/:id — todos opcionales. */
const customerUpdateSchema = {
  name: { type: 'string', minLength: 2, maxLength: 120 },
  companyName: { type: 'string', maxLength: 160 },
  email: { type: 'email' },
  phone: { type: 'string', maxLength: 40 },
  address: { type: 'string', maxLength: 240 },
  status: statusEnum,
};

module.exports = { customerListSchema, customerCreateSchema, customerUpdateSchema };
