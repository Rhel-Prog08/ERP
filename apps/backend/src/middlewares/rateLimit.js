'use strict';

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const RATE_MESSAGE = {
  success: false,
  error: { code: 'RATE_LIMITED', message: 'Demasiadas peticiones. Intente de nuevo más tarde.' },
};

/** Límite global por IP (1000 req / 15 min; alto en pruebas para no molestar). */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isTest ? 100000 : 1000,
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
  max: env.isTest ? 100000 : env.isProd ? 30 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_MESSAGE,
});

module.exports = { globalLimiter, authLimiter };
