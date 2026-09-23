'use strict';

/**
 * Rutas del módulo warehouses.
 * Hook: si branchId viene informado, debe pertenecer a la MISMA empresa
 * que el usuario autenticado (aislamiento multiempresa).
 */
const { createCrud } = require('../../utils/crudFactory');
const Branch = require('../branches/model');
const { NotFoundError } = require('../../utils/errors');
const model = require('./model');
const { warehouseListSchema, warehouseCreateSchema, warehouseUpdateSchema } = require('./validation');

async function assertBranchInCompany(data, actor, session) {
  if (!data.branchId) return data;
  let query = Branch.findOne({ _id: data.branchId, companyId: actor.companyId });
  if (session) query = query.session(session);
  const branch = await query;
  if (!branch) throw new NotFoundError('La sucursal indicada no existe en tu empresa');
  return data;
}

const { router } = createCrud({
  model,
  module: 'warehouses',
  entityLabel: 'Almacén',
  entityName: 'warehouse',
  auditActions: {
    create: 'CREATE_WAREHOUSE',
    update: 'UPDATE_WAREHOUSE',
    deactivate: 'DELETE_WAREHOUSE',
  },
  validation: {
    list: warehouseListSchema,
    create: warehouseCreateSchema,
    update: warehouseUpdateSchema,
  },
  listConfig: {
    searchFields: ['name'],
    sortFields: ['name', 'createdAt', 'status'],
    defaultSort: 'name',
    page: { defaultLimit: 20, maxLimit: 100 },
  },
  softDelete: { field: 'status', value: 'inactive' },
  hooks: {
    async beforeCreate(data, { actor, session }) {
      return assertBranchInCompany(data, actor, session);
    },
    async beforeUpdate(patch, { actor, session }) {
      return assertBranchInCompany(patch, actor, session);
    },
  },
});

module.exports = router;
