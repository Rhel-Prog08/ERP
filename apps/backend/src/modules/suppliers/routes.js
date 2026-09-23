'use strict';

/**
 * Rutas del módulo suppliers.
 * El CRUD (controller + service) lo aporta crudFactory; aquí sólo se
 * declaran: modelo, permisos, validaciones, búsqueda y hooks (código PR-…).
 */
const { createCrud } = require('../../utils/crudFactory');
const { nextSequence, formatCode } = require('../../database/sequence');
const model = require('./model');
const { supplierListSchema, supplierCreateSchema, supplierUpdateSchema } = require('./validation');

const { router } = createCrud({
  model,
  module: 'suppliers',
  entityLabel: 'Proveedor',
  entityName: 'supplier',
  auditActions: {
    create: 'CREATE_SUPPLIER',
    update: 'UPDATE_SUPPLIER',
    deactivate: 'DELETE_SUPPLIER',
  },
  validation: {
    list: supplierListSchema,
    create: supplierCreateSchema,
    update: supplierUpdateSchema,
  },
  listConfig: {
    searchFields: ['name', 'companyName', 'supplierCode', 'email'],
    sortFields: ['name', 'supplierCode', 'createdAt', 'status'],
    defaultSort: '-createdAt',
    page: { defaultLimit: 20, maxLimit: 100 },
  },
  softDelete: { field: 'status', value: 'inactive' },
  hooks: {
    // supplierCode se genera SIEMPRE en el servidor (no viene del cliente).
    async beforeCreate(data, { session }) {
      const seq = await nextSequence(data.companyId, 'supplier', session);
      return { ...data, supplierCode: formatCode('PR', seq) };
    },
  },
});

module.exports = router;
