'use strict';

/**
 * Rutas del módulo permissions — catálogo GLOBAL de permisos.
 * No es multiempresa: la llave `module.action` es idéntica para todas las
 * empresas; lo que varía por empresa es qué claves tiene cada rol (roles).
 * Sólo lectura: el catálogo se siembra desde config/constants.js (seed).
 */
const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const Permission = require('./model');

// GET /api/v1/permissions — listado completo del catálogo (módulo → acción).
router.get(
  '/',
  authenticate,
  authorize('permissions.read'),
  asyncHandler(async (req, res) => {
    const data = await Permission.find().sort({ module: 1, key: 1 }).lean();
    sendSuccess(res, data);
  })
);

module.exports = router;
