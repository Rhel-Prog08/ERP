'use strict';

/**
 * Configuración central del backend.
 * - Carga .env (dotenv NO sobreescribe variables ya definidas).
 * - Falla al arrancar si faltan secretos (fail-fast).
 * - En producción exige secretos fuertes y distintos entre sí.
 */
require('dotenv').config();

const REQUIRED = ['MONGO_URI', 'JWT_SECRET', 'REFRESH_TOKEN_SECRET'];

function fail(msg) {
  // eslint-disable-next-line no-console
  console.error(`[config] ERROR FATAL: ${msg}`);
  process.exit(1);
}

for (const key of REQUIRED) {
  if (!process.env[key]) {
    fail(`Falta la variable de entorno "${key}". Copia .env.example a .env y completa los valores.`);
  }
}

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';
const isTest = env === 'test';

if (isProd) {
  if (process.env.JWT_SECRET.length < 32) fail('JWT_SECRET debe tener al menos 32 caracteres en producción.');
  if (process.env.REFRESH_TOKEN_SECRET.length < 32) fail('REFRESH_TOKEN_SECRET debe tener al menos 32 caracteres en producción.');
  if (process.env.JWT_SECRET === process.env.REFRESH_TOKEN_SECRET) fail('JWT_SECRET y REFRESH_TOKEN_SECRET deben ser distintos.');
  if (!process.env.CLIENT_URL) fail('CLIENT_URL es obligatoria en producción (CORS).');
}

/** CLIENT_URL puede contener varios orígenes separados por coma. */
const clientOrigins = (process.env.CLIENT_URL || 'http://localhost:8081')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function parseIntEnv(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

module.exports = {
  env,
  isProd,
  isTest,
  port: parseIntEnv(process.env.PORT, 4000),
  mongoUri: process.env.MONGO_URI,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  },
  refresh: {
    secret: process.env.REFRESH_TOKEN_SECRET,
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },
  clientOrigins,
  security: {
    maxLoginAttempts: parseIntEnv(process.env.MAX_LOGIN_ATTEMPTS, 5),
    lockoutMinutes: parseIntEnv(process.env.LOGIN_LOCKOUT_MINUTES, 15),
  },
};
