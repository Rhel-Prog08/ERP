'use strict';

/**
 * Conversión segura de duraciones tipo "15m", "7d" a milisegundos/segundos.
 * Usado por refresh tokens, bloqueo de cuentas y respuesta de login.
 */

const UNITS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** '7d' → 604800000 (ms). Si es numérico se interpreta como ms. */
function parseDurationMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const str = String(value || '').trim();
  const match = /^(\d+)\s*([smhd])$/i.exec(str);
  if (match) return parseInt(match[1], 10) * UNITS[match[2].toLowerCase()];
  const plain = parseInt(str, 10);
  if (Number.isFinite(plain)) return plain;
  throw new Error(`Duración inválida: ${value}`);
}

/** '15m' → 900 (segundos, para el campo expiresIn del login). */
function durationToSeconds(value) {
  return Math.floor(parseDurationMs(value) / 1000);
}

/** Fecha absoluta de expiración a partir de una duración. */
function expiryFromNow(value) {
  return new Date(Date.now() + parseDurationMs(value));
}

module.exports = { parseDurationMs, durationToSeconds, expiryFromNow };
