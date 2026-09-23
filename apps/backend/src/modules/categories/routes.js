'use strict';

/**
 * Rutas del módulo categories.
 * El CRUD (controller + service) lo aporta crudFactory; aquí sólo se
 * declaran: modelo, permisos, validaciones, búsqueda y hooks
 * (baja bloqueada si la categoría la usan productos activos).
 */
const { createCrud } = require('../../utils/crudFactory');
const { ConflictError } = require('../../utils/errors');
const Product = require('../products/model');
const model = require('./model');
const { categoryListSchema, categoryCreateSchema, categoryUpdateSchema } = require('./validation');

const { router } = createCrud({
  model,
  module: 'categories',
  entityLabel: 'Categoría',
  entityName: 'category',
  auditActions: {
    create: 'CREATE_CATEGORY',
    update: 'UPDATE_CATEGORY',
    deactivate: 'DELETE_CATEGORY',
  },
  validation: {
    list: categoryListSchema,
    create: categoryCreateSchema,
    update: categoryUpdateSchema,
  },
  listConfig: {
    searchFields: ['name', 'description'],
    sortFields: ['name', 'createdAt', 'status'],
    defaultSort: 'name',
    page: { defaultLimit: 20, maxLimit: 100 },
  },
  softDelete: { field: 'status', value: 'inactive' },
  hooks: {
    // No se puede desactivar una categoría referenciada por productos activos.
    async beforeDelete(doc, { session }) {
      let query = Product.countDocuments({ categoryId: doc._id, status: 'active' });
      if (session) query = query.session(session);
      const count = await query;
      if (count > 0) {
        throw new ConflictError(`No se puede desactivar: ${count} producto(s) activo(s) usan esta categoría`);
      }
    },
  },
});

module.exports = router;
