'use strict';

/**
 * Utilidad pura de propiedad (ownerUserId) — sin acceso a BD, testeable.
 *
 * Regla: un usuario es "propietario" de una empresa cuando el campo
 * `Company.ownerUserId` de esa empresa coincide con su id. Las empresas
 * legacy sin propietario asignado (ownerUserId null/absente) devuelven false:
 * no se auto-asignan propietarios ni se bloquean operaciones por ausencia.
 */
function isOwnerOfCompany(userId, ownerUserId) {
  if (userId === null || userId === undefined || ownerUserId === null || ownerUserId === undefined) {
    return false;
  }
  return String(userId) === String(ownerUserId);
}

module.exports = { isOwnerOfCompany };
