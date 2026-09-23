'use strict';

/**
 * GET /api/v1/dashboard — indicadores reales de la empresa del token.
 * Requiere dashboard.read. Nunca devuelve datos de otra empresa.
 */
const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const service = require('./service');

router.get(
  '/',
  authenticate,
  authorize('dashboard.read'),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await service.getDashboard(req.user));
  })
);

module.exports = router;
