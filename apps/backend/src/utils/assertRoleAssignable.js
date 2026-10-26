'use strict';

const { AuthorizationError, ConflictError } = require('./errors');

function assertRoleAssignable(actor, role) {
  if (role.status !== 'active') {
    throw new ConflictError('No se puede asignar un rol inactivo');
  }

  const actorPermissions = new Set((actor.role && actor.role.permissions) || []);
  const elevatedPermissions = (role.permissions || []).filter(
    (permission) => !actorPermissions.has(permission)
  );
  if (elevatedPermissions.length > 0) {
    throw new AuthorizationError(
      'No tienes autoridad para asignar un rol con permisos que no posees'
    );
  }
}

module.exports = { assertRoleAssignable };
