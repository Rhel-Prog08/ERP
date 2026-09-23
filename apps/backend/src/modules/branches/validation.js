'use strict';

const { STATUSES } = require('../../config/constants');

const statusEnum = { type: 'enum', enum: STATUSES };

const branchListSchema = {
  page: { type: 'integer', min: 1 },
  limit: { type: 'integer', min: 1, max: 100 },
  sort: { type: 'string', maxLength: 40 },
  q: { type: 'string', maxLength: 80 },
  status: statusEnum,
};

const branchCreateSchema = {
  name: { required: true, type: 'string', minLength: 2, maxLength: 120 },
  address: { type: 'string', maxLength: 240 },
  phone: { type: 'string', maxLength: 40 },
  status: statusEnum,
};

const branchUpdateSchema = {
  name: { type: 'string', minLength: 2, maxLength: 120 },
  address: { type: 'string', maxLength: 240 },
  phone: { type: 'string', maxLength: 40 },
  status: statusEnum,
};

module.exports = { branchListSchema, branchCreateSchema, branchUpdateSchema };
