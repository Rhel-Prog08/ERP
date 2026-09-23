'use strict';

/**
 * Rutas del módulo companies — endpoints ESPECIALES (no es un CRUD):
 *  - GET '/'    devuelve SIEMPRE la empresa del token (una petición por empresa).
 *  - POST '/'   crea una nueva empresa y la aprovisiona de forma ATÓMICA:
 *               almacén principal + settings + los 6 roles por defecto.
 *  - PATCH     ':id' edita únicamente la empresa propia (aislamiento 404).
 *
 * NOTA DE AUDITORÍA: en POST, la entrada CREATE_COMPANY se registra en la
 * empresa del ACTOR (req.user.companyId), no en la empresa recién creada:
 * el actor todavía no pertenece a ella y la bitácora es por empresa.
 */
const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../utils/response');
const { validate } = require('../../utils/validate');
const { NotFoundError } = require('../../utils/errors');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { withTransaction } = require('../../config/db');
const { recordAudit, requestMeta } = require('../audit/service');
const settingsService = require('../settings/service');
const { DEFAULT_ROLES, ROLE_PERMISSIONS } = require('../../config/constants');
const Company = require('./model');
const Warehouse = require('../warehouses/model');
const Role = require('../roles/model');
const { companyCreateSchema, companyUpdateSchema } = require('./validation');

/** Campos admitidos en PATCH (whitelist explícita de la actualización). */
const EDITABLE_FIELDS = ['name', 'legalName', 'taxId', 'phone', 'email', 'address', 'status'];

// GET /api/v1/companies — la empresa del usuario autenticado (siempre la del token).
router.get(
  '/',
  authenticate,
  authorize('companies.read'),
  asyncHandler(async (req, res) => {
    const doc = await Company.findOne({ _id: req.user.companyId }).lean();
    if (!doc) throw new NotFoundError('Empresa no encontrada');
    sendSuccess(res, doc);
  })
);

// POST /api/v1/companies — alta + aprovisionamiento transaccional completo.
router.post(
  '/',
  authenticate,
  authorize('companies.create'),
  validate(companyCreateSchema),
  asyncHandler(async (req, res) => {
    const doc = await withTransaction(async (session) => {
      const opts = session ? { session } : {};

      // 1) La empresa en sí, siempre activa.
      const [created] = await Company.create([{ ...req.body, status: 'active' }], opts);

      // 2) Almacén principal (sin sucursal: pertenece a la matriz).
      await Warehouse.create(
        [{ name: 'Almacén Principal', branchId: null, companyId: created._id, status: 'active' }],
        opts
      );

      // 3) Configuración por defecto de la empresa.
      await settingsService.getForCompany(created._id, session);

      // 4) Los 6 roles por defecto, con sus permisos y marcados de sistema.
      for (const name of DEFAULT_ROLES) {
        await Role.create(
          [
            {
              name,
              companyId: created._id,
              permissions: ROLE_PERMISSIONS[name],
              isSystem: true,
              status: 'active',
            },
          ],
          opts
        );
      }

      // 5) Auditoría atómica en la empresa del ACTOR que crea.
      await recordAudit(
        {
          userId: req.user.id,
          companyId: req.user.companyId,
          action: 'CREATE_COMPANY',
          module: 'companies',
          entity: 'company',
          entityId: created._id,
          newValue: created.toObject ? created.toObject() : created,
          description: `Empresa ${created.name} creada y aprovisionada`,
          ...requestMeta(req),
        },
        { session, strict: true }
      );

      return created;
    });

    sendCreated(res, doc);
  })
);

// PATCH /api/v1/companies/:id — sólo la empresa propia; otra empresa → 404.
router.patch(
  '/:id',
  authenticate,
  authorize('companies.update'),
  validate(companyUpdateSchema),
  asyncHandler(async (req, res) => {
    // Aislamiento multiempresa: el id del path debe ser el del token.
    if (String(req.params.id) !== req.user.companyId) {
      throw new NotFoundError('Empresa no encontrada');
    }

    const doc = await withTransaction(async (session) => {
      let findQuery = Company.findOne({ _id: req.user.companyId });
      if (session) findQuery = findQuery.session(session);
      const company = await findQuery;
      if (!company) throw new NotFoundError('Empresa no encontrada');

      // Snapshot SÓLO de los campos presentes en el patch (whitelist).
      const previousValue = {};
      const newValue = {};
      for (const field of EDITABLE_FIELDS) {
        const value = req.body[field];
        if (value === undefined) continue;
        previousValue[field] = company[field] !== undefined ? company[field] : null;
        company[field] = value;
        newValue[field] = value;
      }

      if (Object.keys(newValue).length > 0) {
        await company.save(session ? { session } : {});
        await recordAudit(
          {
            userId: req.user.id,
            companyId: req.user.companyId,
            action: 'UPDATE_COMPANY',
            module: 'companies',
            entity: 'company',
            entityId: company._id,
            previousValue,
            newValue,
            description: `Empresa ${company.name} actualizada`,
            ...requestMeta(req),
          },
          { session, strict: Boolean(session) }
        );
      }

      return company;
    });

    sendSuccess(res, doc);
  })
);

module.exports = router;
