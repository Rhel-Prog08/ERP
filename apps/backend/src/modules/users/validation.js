'use strict';

const { STATUSES } = require('../../config/constants');

const statusEnum = { type: 'enum', enum: STATUSES };

/** GET /users — listado paginado con filtros de empresa. */
const userListSchema = {
  page: { type: 'integer', min: 1 },
  limit: { type: 'integer', min: 1, max: 100 },
  sort: { type: 'string', maxLength: 40 },
  q: { type: 'string', maxLength: 80 },
  status: statusEnum,
  roleId: { type: 'objectId' },
};

/**
 * POST /users — `companyId` sólo se declara para permitir el alta
 * cross-company (exige además companies.create); si no viene o coincide
 * con la del actor, se usa la del token.
 */
const userCreateSchema = {
  firstName: { required: true, type: 'string', minLength: 1, maxLength: 60 },
  lastName: { required: true, type: 'string', minLength: 1, maxLength: 60 },
  email: { required: true, type: 'email' },
  password: { required: true, type: 'string', minLength: 8, maxLength: 128 },
  roleId: { required: true, type: 'objectId' },
  companyId: { type: 'objectId' },
  status: statusEnum,
};

/** PATCH /users/:id — `newPassword` reinicia la contraseña del objetivo. */
const userUpdateSchema = {
  firstName: { type: 'string', minLength: 1, maxLength: 60 },
  lastName: { type: 'string', minLength: 1, maxLength: 60 },
  email: { type: 'email' },
  roleId: { type: 'objectId' },
  status: statusEnum,
  newPassword: { type: 'string', minLength: 8, maxLength: 128 },
};

module.exports = { userListSchema, userCreateSchema, userUpdateSchema };
