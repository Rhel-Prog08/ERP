'use strict';

/**
 * Rutas del módulo customers.
 * El CRUD (controller + service) lo aporta crudFactory; aquí sólo se
 * declaran: modelo, permisos, validaciones, búsqueda y hooks (código CL-…).
 */
const { createCrud } = require('../../utils/crudFactory');
const { nextSequence, formatCode } = require('../../database/sequence');
const model = require('./model');
const { customerListSchema, customerCreateSchema, customerUpdateSchema } = require('./validation');

const { router } = createCrud({
  model,
  module: 'customers',
  entityLabel: 'Cliente',
  entityName: 'customer',
  auditActions: {
    create: 'CREATE_CUSTOMER',
    update: 'UPDATE_CUSTOMER',
    deactivate: 'DELETE_CUSTOMER',
  },
  validation: {
    list: customerListSchema,
    create: customerCreateSchema,
    update: customerUpdateSchema,
  },
  listConfig: {
    searchFields: ['name', 'companyName', 'customerCode', 'email'],
    sortFields: ['name', 'customerCode', 'createdAt', 'status'],
    defaultSort: '-createdAt',
    page: { defaultLimit: 20, maxLimit: 100 },
  },
  softDelete: { field: 'status', value: 'inactive' },
  hooks: {
    // customerCode se genera SIEMPRE en el servidor (no viene del cliente).
    async beforeCreate(data, { session }) {
      const seq = await nextSequence(data.companyId, 'customer', session);
      return { ...data, customerCode: formatCode('CL', seq) };
    },
  },
});

module.exports = router;
