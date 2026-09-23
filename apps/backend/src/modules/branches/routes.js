'use strict';

/** Rutas del módulo branches (CRUD vía crudFactory). */
const { createCrud } = require('../../utils/crudFactory');
const model = require('./model');
const { branchListSchema, branchCreateSchema, branchUpdateSchema } = require('./validation');

const { router } = createCrud({
  model,
  module: 'branches',
  entityLabel: 'Sucursal',
  entityName: 'branch',
  auditActions: {
    create: 'CREATE_BRANCH',
    update: 'UPDATE_BRANCH',
    deactivate: 'DELETE_BRANCH',
  },
  validation: {
    list: branchListSchema,
    create: branchCreateSchema,
    update: branchUpdateSchema,
  },
  listConfig: {
    searchFields: ['name', 'address'],
    sortFields: ['name', 'createdAt', 'status'],
    defaultSort: 'name',
    page: { defaultLimit: 20, maxLimit: 100 },
  },
  softDelete: { field: 'status', value: 'inactive' },
});

module.exports = router;
