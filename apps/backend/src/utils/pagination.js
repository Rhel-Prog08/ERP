'use strict';

const { ValidationError } = require('./errors');

/**
 * Utilidades de paginación y ordenación para listados.
 * Formato de respuesta: { items, pagination:{ page, limit, total, totalPages } }
 */

function getPagination(query = {}, { defaultLimit = 20, maxLimit = 100 } = {}) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;
  return { page, limit, skip: (page - 1) * limit, limitCapped: limit };
}

/**
 * Valida el parámetro `sort` contra una lista de campos permitidos.
 * Acepta 'campo' o '-campo' (desc). Si no es válido usa el orden por defecto.
 */
function getSort(query = {}, allowedFields, defaultSort = '-createdAt') {
  const raw = typeof query.sort === 'string' ? query.sort.trim() : '';
  if (!raw) return defaultSort;
  const desc = raw.startsWith('-');
  const field = desc ? raw.slice(1) : raw;
  if (!allowedFields.includes(field)) {
    throw new ValidationError('Orden no permitido', [
      { field: 'sort', message: `Valores permitidos: ${allowedFields.join(', ')}` },
    ]);
  }
  return desc ? `-${field}` : field;
}

/** Construye el objeto de respuesta paginado. */
function paginated(items, { page, limit }, total) {
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

module.exports = { getPagination, getSort, paginated };
