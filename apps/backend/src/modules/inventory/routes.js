'use strict';

/**
 * Rutas del módulo inventory.
 *
 * GET  /inventory                 → balances (inventory.read)
 * GET  /inventory/movements       → historial (inventory.read)
 * POST /inventory/movements       → movimiento manual; el permiso depende
 *                                   del tipo (entry/exit/adjust) y se
 *                                   comprueba con assertPermission tras
 *                                   validar el body.
 */
const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../utils/response');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { validate, validateQuery } = require('../../utils/validate');
const { assertPermission } = require('../../utils/assertPermission');
const { MOVEMENT_PERMISSION } = require('../../config/constants');
const service = require('./service');
const { balanceListSchema, movementListSchema, movementCreateSchema } = require('./validation');

router.get(
  '/',
  authenticate,
  authorize('inventory.read'),
  validateQuery(balanceListSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await service.listBalances(req.user, req.query));
  })
);

router.get(
  '/movements',
  authenticate,
  authorize('inventory.read'),
  validateQuery(movementListSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await service.listMovements(req.user, req.query));
  })
);

router.post(
  '/movements',
  authenticate,
  validate(movementCreateSchema),
  asyncHandler(async (req, res) => {
    // Permiso dinámico según tipo: ENTRY/RETURN→inventory.entry,
    // EXIT→inventory.exit, ADJUSTMENT→inventory.adjust.
    assertPermission(req, MOVEMENT_PERMISSION[req.body.type]);
    const movement = await service.createManualMovement(req.user, req.body, req);
    sendCreated(res, movement);
  })
);

module.exports = router;
