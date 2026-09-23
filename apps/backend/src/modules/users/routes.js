'use strict';

/**
 * Rutas del módulo users — gestión de usuarios POR EMPRESA (custom, NO factory).
 * Controladores delgados: toda la lógica vive en ./service.js.
 * Ningún endpoint acepta companyId del cliente salvo el alta cross-company
 * documentada en service.create (y que exige además companies.create).
 */
const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../utils/response');
const { validate, validateQuery } = require('../../utils/validate');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const service = require('./service');
const { userListSchema, userCreateSchema, userUpdateSchema } = require('./validation');

// GET /api/v1/users — listado paginado + búsqueda (?q=) de la empresa del token.
router.get(
  '/',
  authenticate,
  authorize('users.read'),
  validateQuery(userListSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await service.list(req.user, req.query));
  })
);

// GET /api/v1/users/:id — detalle (password/refreshTokens: select:false).
router.get(
  '/:id',
  authenticate,
  authorize('users.read'),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await service.get(req.user, req.params.id));
  })
);

// POST /api/v1/users — alta (fuerza de contraseña + unicidad de email).
router.post(
  '/',
  authenticate,
  authorize('users.create'),
  validate(userCreateSchema),
  asyncHandler(async (req, res) => {
    sendCreated(res, await service.create(req.user, req.body, req));
  })
);

// PATCH /api/v1/users/:id — edición con guards de autorreferencia.
router.patch(
  '/:id',
  authenticate,
  authorize('users.update'),
  validate(userUpdateSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await service.update(req.user, req.params.id, req.body, req));
  })
);

// DELETE /api/v1/users/:id — baja lógica (soft delete) + revocación de sesión.
router.delete(
  '/:id',
  authenticate,
  authorize('users.delete'),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await service.deactivate(req.user, req.params.id, req));
  })
);

module.exports = router;
