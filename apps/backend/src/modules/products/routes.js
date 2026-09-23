'use strict';

/**
 * Rutas del módulo products.
 * El CRUD (controller + service) lo aporta crudFactory; aquí sólo se
 * declaran: modelo, permisos, validaciones, búsqueda y hooks
 * (categoryId/supplierId deben pertenecer a la misma empresa).
 */
const { createCrud } = require('../../utils/crudFactory');
const { NotFoundError } = require('../../utils/errors');
const Category = require('../categories/model');
const Supplier = require('../suppliers/model');
const model = require('./model');
const { productListSchema, productCreateSchema, productUpdateSchema } = require('./validation');

/** Comprueba que un referencial (categoría/proveedor) exista en la empresa del actor. */
async function assertExists(Model, id, companyId, session, notFoundMessage) {
  let query = Model.findOne({ _id: id, companyId });
  if (session) query = query.session(session);
  const doc = await query;
  if (!doc) throw new NotFoundError(notFoundMessage);
}

const { router } = createCrud({
  model,
  module: 'products',
  entityLabel: 'Producto',
  entityName: 'product',
  auditActions: {
    create: 'CREATE_PRODUCT',
    update: 'UPDATE_PRODUCT',
    deactivate: 'DELETE_PRODUCT',
  },
  validation: {
    list: productListSchema,
    create: productCreateSchema,
    update: productUpdateSchema,
  },
  listConfig: {
    searchFields: ['sku', 'name', 'description'],
    sortFields: ['name', 'sku', 'createdAt', 'status'],
    defaultSort: '-createdAt',
    page: { defaultLimit: 20, maxLimit: 100 },
  },
  softDelete: { field: 'status', value: 'inactive' },
  hooks: {
    // create: categoryId es obligatorio y supplierId opcional; ambos de la empresa.
    async beforeCreate(data, { session }) {
      if (data.categoryId) {
        await assertExists(
          Category,
          data.categoryId,
          data.companyId,
          session,
          'La categoría indicada no existe en tu empresa'
        );
      }
      if (data.supplierId) {
        await assertExists(
          Supplier,
          data.supplierId,
          data.companyId,
          session,
          'El proveedor indicado no existe en tu empresa'
        );
      }
      return data;
    },
    // update: el patch puede no traer categoryId/supplierId → sólo validar los presentes.
    async beforeUpdate(patch, { actor, session }) {
      if (patch.categoryId) {
        await assertExists(
          Category,
          patch.categoryId,
          actor.companyId,
          session,
          'La categoría indicada no existe en tu empresa'
        );
      }
      if (patch.supplierId) {
        await assertExists(
          Supplier,
          patch.supplierId,
          actor.companyId,
          session,
          'El proveedor indicado no existe en tu empresa'
        );
      }
      return patch;
    },
  },
});

module.exports = router;
