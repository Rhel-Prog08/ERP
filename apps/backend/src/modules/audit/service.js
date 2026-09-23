'use strict';

const AuditLog = require('./model');
const { getPagination, paginated } = require('../../utils/pagination');

/**
 * Servicio único de escritura de auditoría — todos los módulos lo usan.
 *
 * @param {object} entry  { userId, companyId, action, module, entity, entityId,
 *                          previousValue, newValue, description, req }
 * @param {object} opts   { session, strict }
 *   - session: se pasa dentro de transacciones críticas (venta/compra) para
 *     que auditoría + inventario + documento sean atómicos.
 *   - strict:   si es true los errores se propagan (rompe la transacción,
 *     mantiene coherencia); si es false se registran en consola y el flujo
 *     principal continúa (operaciones no críticas).
 */
async function recordAudit(entry, { session = null, strict = false } = {}) {
  try {
    const doc = {
      userId: entry.userId || undefined,
      companyId: entry.companyId,
      action: entry.action,
      module: entry.module,
      entity: entry.entity || undefined,
      entityId: entry.entityId ? String(entry.entityId) : undefined,
      previousValue: entry.previousValue,
      newValue: entry.newValue,
      description: entry.description ? String(entry.description).slice(0, 500) : undefined,
      ip: entry.ip,
      userAgent: entry.userAgent ? String(entry.userAgent).slice(0, 300) : undefined,
    };

    if (session) {
      await AuditLog.create([doc], { session });
    } else {
      await AuditLog.create(doc);
    }
  } catch (err) {
    if (strict) throw err;
    // eslint-disable-next-line no-console
    console.error(`[audit] No se pudo registrar ${entry.action}: ${err.message}`);
  }
}

/** Extrae IP y userAgent de la petición para adjuntarlos a la auditoría. */
function requestMeta(req) {
  if (!req) return {};
  return {
    ip: (req.ip || req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim().slice(0, 60) || undefined,
    userAgent: req.headers['user-agent'] || undefined,
  };
}

/** Atajo: auditoría típica de un usuario autenticado vía request. */
async function auditFromReq(req, data, opts) {
  if (!req || !req.user) return;
  return recordAudit(
    {
      userId: req.user.id,
      companyId: req.user.companyId,
      ...data,
      ...requestMeta(req),
    },
    opts
  );
}

/**
 * Filtro común de bitácora (reutilizado por GET /audit y el reporte de
 * auditoría). SIEMPRE limitado a la empresa del actor.
 */
function buildAuditFilter(actor, query = {}) {
  const filter = { companyId: actor.companyId };
  if (query.action) filter.action = query.action;
  if (query.module) filter.module = query.module;
  if (query.entity) filter.entity = query.entity;
  if (query.entityId) filter.entityId = query.entityId;
  if (query.userId) filter.userId = query.userId;
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) {
      const d = new Date(query.dateFrom);
      d.setHours(0, 0, 0, 0);
      filter.createdAt.$gte = d;
    }
    if (query.dateTo) {
      const d = new Date(query.dateTo);
      d.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = d;
    }
  }
  return filter;
}

/** Listado paginado de auditoría (lectura). */
async function listLogs(actor, query = {}) {
  const { page, limit, skip } = getPagination(query, { defaultLimit: 25, maxLimit: 100 });
  const filter = buildAuditFilter(actor, query);

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('userId', 'firstName lastName email')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  return paginated(items, { page, limit }, total);
}

module.exports = { recordAudit, auditFromReq, requestMeta, buildAuditFilter, listLogs };
