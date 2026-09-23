'use strict';

/**
 * GET /api/v1/audit — bitácora de SOLO LECTURA (audit.read).
 * No existen POST/PATCH/DELETE: el modelo además bloquea escrituras.
 * La auditoría se escribe exclusivamente vía recordAudit() interno.
 */
const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { validateQuery } = require('../../utils/validate');
const { listLogs } = require('./service');
const { auditListSchema } = require('./validation');

router.get(
  '/',
  authenticate,
  authorize('audit.read'),
  validateQuery(auditListSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await listLogs(req.user, req.query));
  })
);

module.exports = router;
