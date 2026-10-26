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
const registration = require('../registration/service');
const { userListSchema, userCreateSchema, userUpdateSchema } = require('./validation');
const {
  invitationListSchema,
  validateInvitationCreate,
} = require('../registration/validation');

/* --------------------------------------------------------------- *
 * Invitaciones de registro (deben ir ANTES de las rutas /:id para
 * que "invitations" no se interprete como un ObjectId de usuario).
 * --------------------------------------------------------------- */

// GET /api/v1/users/invitations — invitaciones de la empresa del token.
router.get(
  '/invitations',
  authenticate,
  authorize('users.read'),
  validateQuery(invitationListSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await registration.listInvitations(req.user, req.query));
  })
);

// POST /api/v1/users/invitations — crea invitación y envía el correo.
router.post(
  '/invitations',
  authenticate,
  authorize('users.create'),
  validateInvitationCreate,
  asyncHandler(async (req, res) => {
    sendCreated(res, await registration.createInvitation(req.user, req.body, req));
  })
);

// DELETE /api/v1/users/invitations/:id — revoca una invitación pendiente.
router.delete(
  '/invitations/:id',
  authenticate,
  authorize('users.update'),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await registration.revokeInvitation(req.user, req.params.id, req));
  })
);

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
