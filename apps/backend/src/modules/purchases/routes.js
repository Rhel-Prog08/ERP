'use strict';

/**
 * Rutas del módulo purchases (FLUJO B).
 *
 * POST /purchases               → borrador                (purchases.create)
 * POST /purchases/:id/confirm   → CONFIRMED               (purchases.update)
 * POST /purchases/:id/receive   → inventario + movimiento  (purchases.update)
 * POST /purchases/:id/cancel    → reversa si RECEIVED      (purchases.cancel)
 */
const router = require('express').Router();
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { validate, validateQuery } = require('../../utils/validate');
const controller = require('./controller');
const { purchaseListSchema, purchaseCreateSchema, purchaseCancelSchema } = require('./validation');

router.get('/', authenticate, authorize('purchases.read'), validateQuery(purchaseListSchema), controller.list);
router.get('/:id', authenticate, authorize('purchases.read'), controller.get);
router.post('/', authenticate, authorize('purchases.create'), validate(purchaseCreateSchema), controller.create);
router.post('/:id/confirm', authenticate, authorize('purchases.update'), controller.confirm);
router.post('/:id/receive', authenticate, authorize('purchases.update'), controller.receive);
router.post('/:id/cancel', authenticate, authorize('purchases.cancel'), validate(purchaseCancelSchema), controller.cancel);

module.exports = router;
