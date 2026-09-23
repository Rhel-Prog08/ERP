'use strict';

const { STATUSES } = require('../../config/constants');

const statusEnum = { type: 'enum', enum: STATUSES };

const warehouseListSchema = {
  page: { type: 'integer', min: 1 },
  limit: { type: 'integer', min: 1, max: 100 },
  sort: { type: 'string', maxLength: 40 },
  q: { type: 'string', maxLength: 80 },
  status: statusEnum,
  branchId: { type: 'objectId' },
};

const warehouseCreateSchema = {
  name: { required: true, type: 'string', minLength: 2, maxLength: 120 },
  branchId: { type: 'objectId' },
  status: statusEnum,
};

const warehouseUpdateSchema = {
  name: { type: 'string', minLength: 2, maxLength: 120 },
  branchId: { type: 'objectId' },
  status: statusEnum,
};

module.exports = { warehouseListSchema, warehouseCreateSchema, warehouseUpdateSchema };
