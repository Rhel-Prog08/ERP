'use strict';

const { STATUSES } = require('../../config/constants');

const statusEnum = { type: 'enum', enum: STATUSES };

/** GET /categories — paginación, búsqueda y filtros. */
const categoryListSchema = {
  page: { type: 'integer', min: 1 },
  limit: { type: 'integer', min: 1, max: 100 },
  sort: { type: 'string', maxLength: 40 },
  q: { type: 'string', maxLength: 80 },
  status: statusEnum,
};

/** POST /categories */
const categoryCreateSchema = {
  name: { required: true, type: 'string', minLength: 1, maxLength: 80 },
  description: { type: 'string', maxLength: 240 },
  status: statusEnum,
};

/** PATCH /categories/:id — todos opcionales. */
const categoryUpdateSchema = {
  name: { type: 'string', minLength: 1, maxLength: 80 },
  description: { type: 'string', maxLength: 240 },
  status: statusEnum,
};

module.exports = { categoryListSchema, categoryCreateSchema, categoryUpdateSchema };
