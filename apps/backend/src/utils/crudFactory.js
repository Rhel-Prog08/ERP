'use strict';

/**
 * createCrud — fábrica de módulos CRUD del ERP.
 *
 * Centraliza el patrón repetido de todos los módulos maestros para evitar
 * código duplicado: listado paginado + búsqueda, get con aislamiento por
 * empresa, create/update transaccionales con auditoría y baja lógica.
 *
 * Garantías que aplica SIEMPRE:
 *  - companyId proviene del usuario autenticado (nunca del cliente).
 *  - Todos los filtros quedan limitados a { companyId: actor.companyId }.
 *  - Auditoría atómica con la operación cuando hay transacciones.
 *  - Respuestas con el sobre { success, data }.
 *
 * Config:
 *  - model            modelo mongoose
 *  - module           clave de permisos ('customers' → customers.read/create/…)
 *  - entityLabel      'Cliente' (mensajes)
 *  - entityName       'customer' (auditoría)
 *  - auditActions     { create, update, deactivate }
 *  - validation       { create, update, list} esquemas crudos de validate.js
 *  - listConfig       { searchFields, sortFields, defaultSort, page }
 *  - getConfig        { populate }
 *  - softDelete       { field, value } p. ej. { field:'status', value:'inactive' }
 *  - hooks            { beforeCreate(data,{actor,session,req}),
 *                       beforeUpdate(patch,{doc,actor,session,req}),
 *                       beforeDelete(doc,{actor,session,req}) }
 */
const { Router } = require('express');
const asyncHandler = require('./asyncHandler');
const { sendSuccess, sendCreated } = require('./response');
const { NotFoundError } = require('./errors');
const { getPagination, getSort, paginated } = require('./pagination');
const { validate, validateQuery } = require('./validate');
const { escapeRegex } = require('./regex');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const { withTransaction } = require('../config/db');
const { recordAudit, requestMeta } = require('../modules/audit/service');

const RESERVED_QUERY = new Set(['page', 'limit', 'sort', 'q']);

function createCrud(config) {
  const {
    model,
    module,
    entityLabel,
    entityName,
    auditActions = {},
    validation = {},
    listConfig = {},
    getConfig = {},
    softDelete = null,
    hooks = {},
  } = config;

  /* ------------------------------- SERVICE ------------------------------- */

  const service = {
    async list(actor, query = {}) {
      const { page, limit, skip } = getPagination(query, listConfig.page || {});
      const sort = getSort(
        query,
        listConfig.sortFields || [],
        listConfig.defaultSort || '-createdAt'
      );

      const filter = { companyId: actor.companyId };
      // Filtros declarados en el esquema list (whitelist ya aplicada por validateQuery).
      for (const [key, value] of Object.entries(query)) {
        if (!RESERVED_QUERY.has(key) && value !== undefined && value !== '') {
          filter[key] = value;
        }
      }
      if (query.q && Array.isArray(listConfig.searchFields) && listConfig.searchFields.length) {
        const rx = new RegExp(escapeRegex(query.q), 'i');
        filter.$or = listConfig.searchFields.map((f) => ({ [f]: rx }));
      }

      let findQuery = model.find(filter);
      if (getConfig.populateList) findQuery = findQuery.populate(getConfig.populateList);

      const [items, total] = await Promise.all([
        findQuery.skip(skip).limit(limit).sort(sort).lean(),
        model.countDocuments(filter),
      ]);
      return paginated(items, { page, limit }, total);
    },

    async get(actor, id) {
      let query = model.findOne({ _id: id, companyId: actor.companyId });
      if (getConfig.populate) query = query.populate(getConfig.populate);
      const doc = await query.lean();
      if (!doc) throw new NotFoundError(`${entityLabel} no encontrado`);
      return doc;
    },

    async create(actor, body, req) {
      return withTransaction(async (session) => {
        let data = { ...body, companyId: actor.companyId };
        if (hooks.beforeCreate) {
          data = await hooks.beforeCreate(data, { actor, session, req });
        }
        const created = await model.create([data], session ? { session } : {});
        const doc = created[0];
        await recordAudit(
          {
            userId: actor.id,
            companyId: actor.companyId,
            action: auditActions.create,
            module,
            entity: entityName,
            entityId: doc._id,
            newValue: doc.toObject ? doc.toObject() : doc,
            description: `${entityLabel} creado`,
            ...requestMeta(req),
          },
          { session, strict: Boolean(session) }
        );
        return doc;
      });
    },

    async update(actor, id, body, req) {
      return withTransaction(async (session) => {
        let findQuery = model.findOne({ _id: id, companyId: actor.companyId });
        if (session) findQuery = findQuery.session(session);
        const doc = await findQuery;
        if (!doc) throw new NotFoundError(`${entityLabel} no encontrado`);

        let patch = { ...body };
        if (hooks.beforeUpdate) {
          patch = await hooks.beforeUpdate(patch, { doc, actor, session, req });
        }

        const previousValue = {};
        const newValue = {};
        for (const [key, value] of Object.entries(patch)) {
          if (value === undefined) continue;
          previousValue[key] = doc[key] !== undefined ? doc[key] : null;
          doc[key] = value;
          newValue[key] = value;
        }
        if (hooks.beforeSave) await hooks.beforeSave(doc, { actor, session, req });

        if (Object.keys(newValue).length > 0) {
          const saveOpts = session ? { session } : {};
          await doc.save(saveOpts);
          await recordAudit(
            {
              userId: actor.id,
              companyId: actor.companyId,
              action: auditActions.update,
              module,
              entity: entityName,
              entityId: doc._id,
              previousValue,
              newValue,
              description: `${entityLabel} actualizado`,
              ...requestMeta(req),
            },
            { session, strict: Boolean(session) }
          );
        }
        return doc;
      });
    },

    async deactivate(actor, id, req) {
      if (!softDelete) throw new NotFoundError(`${entityLabel} no encontrado`);
      return withTransaction(async (session) => {
        let findQuery = model.findOne({ _id: id, companyId: actor.companyId });
        if (session) findQuery = findQuery.session(session);
        const doc = await findQuery;
        if (!doc) throw new NotFoundError(`${entityLabel} no encontrado`);

        if (hooks.beforeDelete) {
          await hooks.beforeDelete(doc, { actor, session, req });
        }

        if (doc[softDelete.field] === softDelete.value) return doc; // ya inactivo

        doc[softDelete.field] = softDelete.value;
        const saveOpts = session ? { session } : {};
        await doc.save(saveOpts);

        await recordAudit(
          {
            userId: actor.id,
            companyId: actor.companyId,
            action: auditActions.deactivate,
            module,
            entity: entityName,
            entityId: doc._id,
            previousValue: { [softDelete.field]: 'active' },
            newValue: { [softDelete.field]: softDelete.value },
            description: `${entityLabel} desactivado`,
            ...requestMeta(req),
          },
          { session, strict: Boolean(session) }
        );
        return doc;
      });
    },
  };

  /* ------------------------------ CONTROLLER ----------------------------- */

  const controller = {
    list: asyncHandler(async (req, res) => {
      sendSuccess(res, await service.list(req.user, req.query));
    }),
    get: asyncHandler(async (req, res) => {
      sendSuccess(res, await service.get(req.user, req.params.id));
    }),
    create: asyncHandler(async (req, res) => {
      sendCreated(res, await service.create(req.user, req.body, req));
    }),
    update: asyncHandler(async (req, res) => {
      sendSuccess(res, await service.update(req.user, req.params.id, req.body, req));
    }),
    deactivate: asyncHandler(async (req, res) => {
      sendSuccess(res, await service.deactivate(req.user, req.params.id, req));
    }),
  };

  /* -------------------------------- ROUTER ------------------------------- */

  const router = Router();
  router.get('/', authenticate, authorize(`${module}.read`), validateQuery(validation.list || {}), controller.list);
  router.get('/:id', authenticate, authorize(`${module}.read`), controller.get);
  router.post('/', authenticate, authorize(`${module}.create`), validate(validation.create || {}), controller.create);
  router.patch('/:id', authenticate, authorize(`${module}.update`), validate(validation.update || {}), controller.update);
  if (softDelete) {
    router.delete('/:id', authenticate, authorize(`${module}.delete`), controller.deactivate);
  }

  router.service = service; // expuesto para pruebas integradas
  return { router, service, controller };
}

module.exports = { createCrud };
