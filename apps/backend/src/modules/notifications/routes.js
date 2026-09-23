'use strict';

/**
 * Rutas del módulo notifications — sin CRUD completo:
 *  - GET '/'            listado paginado (filtro opcional por leída/no leída).
 *  - PATCH '/:id/read'  marcar como leída.
 *
 * NOTA DE AUDITORÍA: marcar una notificación como leída NO es una operación
 * crítica (es un gesto de UI sin efecto económico ni de seguridad), por lo
 * que este módulo NO registra entradas en auditLogs.
 */
const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const { validateQuery } = require('../../utils/validate');
const { NotFoundError } = require('../../utils/errors');
const { getPagination, paginated } = require('../../utils/pagination');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const Notification = require('./model');

/** GET / — parámetros de listado (validateQuery hace whitelist + coerce). */
const notificationListSchema = {
  page: { type: 'integer', min: 1 },
  limit: { type: 'integer', min: 1, max: 100 },
  read: { type: 'boolean' },
};

// GET /api/v1/notifications — notificaciones de la empresa del token.
router.get(
  '/',
  authenticate,
  authorize('notifications.read'),
  validateQuery(notificationListSchema),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);

    const filter = { companyId: req.user.companyId };
    if (req.query.read !== undefined) filter.read = req.query.read;

    const [items, total] = await Promise.all([
      Notification.find(filter).sort('-createdAt').skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
    ]);

    sendSuccess(res, paginated(items, { page, limit }, total));
  })
);

// PATCH /api/v1/notifications/:id/read — marcar como leída (sin auditoría).
router.patch(
  '/:id/read',
  authenticate,
  authorize('notifications.update'),
  asyncHandler(async (req, res) => {
    const doc = await Notification.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!doc) throw new NotFoundError('Notificación no encontrada');

    doc.read = true;
    await doc.save();

    sendSuccess(res, doc);
  })
);

module.exports = router;
