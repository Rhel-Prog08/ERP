'use strict';

const { STATUSES } = require('../../config/constants');

const statusEnum = { type: 'enum', enum: STATUSES };

/** POST /companies — alta de empresa (el status se fuerza a 'active'). */
const companyCreateSchema = {
  name: { required: true, type: 'string', minLength: 2, maxLength: 120 },
  legalName: { type: 'string', maxLength: 160 },
  taxId: { type: 'string', maxLength: 40 },
  phone: { type: 'string', maxLength: 40 },
  email: { type: 'email' },
  address: { type: 'string', maxLength: 240 },
};

/** PATCH /companies/:id — mismos campos, todos opcionales + status. */
const companyUpdateSchema = {
  name: { type: 'string', minLength: 2, maxLength: 120 },
  legalName: { type: 'string', maxLength: 160 },
  taxId: { type: 'string', maxLength: 40 },
  phone: { type: 'string', maxLength: 40 },
  email: { type: 'email' },
  address: { type: 'string', maxLength: 240 },
  status: statusEnum,
};

module.exports = { companyCreateSchema, companyUpdateSchema };
