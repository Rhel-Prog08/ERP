'use strict';

const { AuthenticationError, AuthorizationError } = require('../utils/errors');

/**
 * Autorización RBAC (backend, nunca se confía sólo en el frontend).
 * Uso: router.get('/', authenticate, authorize('products.read'), controller.list)
 * Varias claves = cualquiera sirve (OR).
 */
function authorize(...keys) {
  return (req, res, next) => {
    if (!req.user) return next(new AuthenticationError());
    const perms = req.user.role.permissions || [];
    const allowed = keys.length === 0 || keys.some((k) => perms.includes(k));
    if (!allowed) {
      return next(new AuthorizationError(`Permiso requerido: ${keys.join(' o ')}`));
    }
    return next();
  };
}

module.exports = { authorize };
