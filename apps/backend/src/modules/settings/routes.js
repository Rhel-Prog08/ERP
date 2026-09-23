'use strict';

/**
 * Rutas del módulo settings (singleton por empresa — no usa crudFactory).
 * GET  /settings  → ajustes de la empresa del token (find-or-create)
 * PATCH /settings → actualiza taxRate / allowNegativeStock + auditoría
 */
const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { validate } = require('../../utils/validate');
const { auditFromReq } = require('../audit/service');
const service = require('./service');
const { settingsUpdateSchema } = require('./validation');

router.get(
  '/',
  authenticate,
  authorize('settings.read'),
  asyncHandler(async (req, res) => {
    const doc = await service.getForCompany(req.user.companyId);
    sendSuccess(res, {
      id: doc._id,
      companyId: doc.companyId,
      taxRate: doc.taxRate,
      allowNegativeStock: doc.allowNegativeStock,
      updatedAt: doc.updatedAt,
    });
  })
);

router.patch(
  '/',
  authenticate,
  authorize('settings.update'),
  validate(settingsUpdateSchema),
  asyncHandler(async (req, res) => {
    const { before, after, doc } = await service.updateForCompany(req.user.companyId, req.body);
    if (Object.keys(req.body).length > 0) {
      await auditFromReq(req, {
        action: 'UPDATE_SETTINGS',
        module: 'settings',
        entity: 'settings',
        entityId: doc._id,
        previousValue: before,
        newValue: after,
        description: 'Configuración de la empresa actualizada',
      });
    }
    sendSuccess(res, {
      id: doc._id,
      companyId: doc.companyId,
      taxRate: doc.taxRate,
      allowNegativeStock: doc.allowNegativeStock,
      updatedAt: doc.updatedAt,
    });
  })
);

module.exports = router;
