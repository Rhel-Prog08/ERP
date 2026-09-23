'use strict';

const { AuthorizationError } = require('./errors');

/**
 * Verificación de permisos para casos donde el permiso depende del
 * contenido de la petición (p. ej. tipo de movimiento de inventario,
 * exportación con ?format=csv o creación cross-company).
 * Para permisos fijos se usa el middleware authorize() de middlewares/.
 */
function assertPermission(req, ...keys) {
  const perms = (req.user && req.user.role && req.user.role.permissions) || [];
  const ok = keys.length === 0 || keys.some((k) => perms.includes(k));
  if (!ok) {
    throw new AuthorizationError(`Permiso requerido: ${keys.join(' o ')}`);
  }
}

module.exports = { assertPermission };
