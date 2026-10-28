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

/**
 * URL base (HTTPS en producción) para enlaces de verificación/invitación.
 * Por defecto, el primer origen de CLIENT_URL (el frontend).
 */
const appUrl = (process.env.APP_URL || clientOrigins[0] || '').replace(/\/+$/, '');
if (isProd && appUrl.startsWith('http://')) {
  fail('APP_URL/CLIENT_URL debe ser HTTPS en producción (los enlaces de verificación deben ser HTTPS).');
}

/**
 * Proveedor de correo transaccional: 'resend' | 'smtp' | 'none'.
 * - resend: API REST de Resend (RESEND_API_KEY), sin dependencias extra.
 * - smtp:   servidor SMTP arbitrario vía nodemailer (SMTP_HOST/USER/PASS).
 * - none:   sin proveedor (flujo preparado, envíos NO se intentan).
 * `configured` es lo que decide si el registro público puede operar.
 */
const mailProvider = (process.env.MAIL_PROVIDER || 'none').toLowerCase();
const mail = {
  provider: mailProvider,
  from: process.env.MAIL_FROM || 'CodeEvo ERP <no-reply@localhost>',
  resendApiKey: process.env.RESEND_API_KEY || '',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseIntEnv(process.env.SMTP_PORT, 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
};
mail.configured =
  (mail.provider === 'resend' && Boolean(mail.resendApiKey)) ||
  (mail.provider === 'smtp' && Boolean(mail.smtp.host && mail.smtp.user && mail.smtp.pass)) ||
  (mail.provider === 'test' && isTest); // doble de pruebas: sólo en NODE_ENV=test

/**
 * Registro público controlado por invitación. Apagado POR DEFECTO en todos
 * los entornos: en producción exige activación explícita (REGISTRATION_ENABLED=true)
 * Y un proveedor de correo configurado; sin correo no hay verificación posible.
 */
const registrationEnabled =
  process.env.REGISTRATION_ENABLED === 'true' && mail.configured;

module.exports = {
  env,
  isProd,
  isTest,
  port: parseIntEnv(process.env.PORT, 4000),
  mongoUri: process.env.MONGO_URI,
  appUrl,
  mail,
  registration: {
    enabled: registrationEnabled,
    /** Caducidad del token de verificación de correo (minutos). */
    verificationTtlMinutes: parseIntEnv(process.env.VERIFICATION_TTL_MINUTES, 30),
    /** Caducidad de una invitación de registro (días). */
    invitationTtlDays: parseIntEnv(process.env.INVITATION_TTL_DAYS, 7),
    /** Enfriamiento mínimo entre reenvíos de verificación por cuenta (segundos). */
    resendCooldownSeconds: parseIntEnv(process.env.VERIFICATION_RESEND_COOLDOWN_SECONDS, 120),
    /** Enfriamiento mínimo entre reenvíos de invitación por invitación (segundos). */
    invitationResendCooldownSeconds: parseIntEnv(process.env.INVITATION_RESEND_COOLDOWN_SECONDS, 60),
  },
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
