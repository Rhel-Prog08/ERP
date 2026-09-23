'use strict';

/**
 * Rutas del módulo sales (FLUJO C).
 *
 * POST /sales              → borrador            (sales.create)
 * POST /sales/:id/confirm  → descuenta inventario (sales.update)
 * POST /sales/:id/complete → cierre de negocio    (sales.update)
 * POST /sales/:id/cancel   → revierte inventario  (sales.cancel)
 */
const router = require('express').Router();
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { validate, validateQuery } = require('../../utils/validate');
const controller = require('./controller');
const { saleListSchema, saleCreateSchema, saleCancelSchema } = require('./validation');

router.get('/', authenticate, authorize('sales.read'), validateQuery(saleListSchema), controller.list);
router.get('/:id', authenticate, authorize('sales.read'), controller.get);
router.post('/', authenticate, authorize('sales.create'), validate(saleCreateSchema), controller.create);
router.post('/:id/confirm', authenticate, authorize('sales.update'), controller.confirm);
router.post('/:id/complete', authenticate, authorize('sales.update'), controller.complete);
router.post('/:id/cancel', authenticate, authorize('sales.cancel'), validate(saleCancelSchema), controller.cancel);

module.exports = router;
