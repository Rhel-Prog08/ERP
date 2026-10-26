'use strict';

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const RATE_MESSAGE = {
  success: false,
  error: { code: 'RATE_LIMITED', message: 'Demasiadas peticiones. Intente de nuevo más tarde.' },
};

/**
 * Límites CONTROLADOS para pruebas (sólo NODE_ENV=test): permiten provocar
 * 429 real en los probes de tests/probes/*.js definiendo, por ejemplo,
 * TEST_RATE_LIMIT_REGISTER_MAX=2 en el entorno del proceso hijo. Sin la
 * variable, se conserva el máximo alto por defecto de las suites integradas.
 * Fuera de test estas variables se IGNORAN por completo.
 */
function testMax(name, fallback) {
  if (!env.isTest) return fallback;
  const raw = parseInt(process.env[name], 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/** Límite global por IP (1000 req / 15 min; alto en pruebas para no molestar). */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: testMax('TEST_RATE_LIMIT_GLOBAL_MAX', 100000),
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_MESSAGE,
});

/**
 * Límite agresivo para /auth/login (complementa el bloqueo por cuenta
 * que aplica el servicio de login tras MAX_LOGIN_ATTEMPTS fallos).
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: testMax('TEST_RATE_LIMIT_AUTH_MAX', env.isTest ? 100000 : env.isProd ? 30 : 100),
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_MESSAGE,
});

/**
 * Registro público por invitación: muy acotado (sólo lo usan titulares
 * de una invitación válida; en producción 5 altas / 15 min / IP).
 */
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: testMax('TEST_RATE_LIMIT_REGISTER_MAX', env.isTest ? 100000 : env.isProd ? 5 : 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_MESSAGE,
});

/**
 * Verificación de correo: limita el fuerza bruta sobre tokens opacos
 * (32 bytes, pero la capa extra por IP es defense-in-depth).
 */
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: testMax('TEST_RATE_LIMIT_VERIFY_MAX', env.isTest ? 100000 : env.isProd ? 30 : 100),
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_MESSAGE,
});

/**
 * Reenvío de verificación: el más restrictivo (5 / 15 min / IP) para
 * impedir spam hacia terceros; además el servicio aplica enfriamiento
 * POR CUENTA entre reenvíos.
 */
const resendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: testMax('TEST_RATE_LIMIT_RESEND_MAX', env.isTest ? 100000 : env.isProd ? 5 : 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_MESSAGE,
});

module.exports = { globalLimiter, authLimiter, registerLimiter, verifyLimiter, resendLimiter };
