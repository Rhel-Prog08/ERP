'use strict';

const crypto = require('crypto');

/**
 * Tokens opacos de un solo uso (verificación de correo, invitaciones).
 * El token es aleatorio y criptográfico (URL-safe); en servidor SÓLO se
 * persiste su hash SHA-256, nunca el valor en claro.
 */
function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

module.exports = { generateToken, hashToken };
