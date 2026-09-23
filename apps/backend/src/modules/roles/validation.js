'use strict';

const { STATUSES } = require('../../config/constants');

const statusEnum = { type: 'enum', enum: STATUSES };

/** Sólo claves del catálogo global de permisos (se contrastan contra DB). */
const permissionsField = {
  type: 'array',
  minLength: 0,
  maxLength: 80,
  items: { type: 'string', maxLength: 60 },
};

/** POST /roles */
const roleCreateSchema = {
  name: { required: true, type: 'string', minLength: 2, maxLength: 60 },
  permissions: permissionsField,
  status: statusEnum,
};

/** PATCH /roles/:id — mismos campos, todos opcionales. */
const roleUpdateSchema = {
  name: { type: 'string', minLength: 2, maxLength: 60 },
  permissions: permissionsField,
  status: statusEnum,
};

module.exports = { roleCreateSchema, roleUpdateSchema };
