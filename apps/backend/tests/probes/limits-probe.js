'use strict';

/**
 * tests/probes/limits-probe.js — PROBE DE RATE LIMITS (FASE F, ETAPA 1)
 *
 * Se ejecuta como PROCESO HIJO desde tests/security.test.js con límites
 * CONTROLADOS por entorno (sólo válidos en NODE_ENV=test):
 *   TEST_RATE_LIMIT_REGISTER_MAX=2, VERIFY=2, RESEND=2, AUTH=5
 *
 * Verifica, provocando HTTP 429 REAL:
 *  - /auth/register     → 2 peticiones pasan (400 por invitación basura),
 *                         la 3ª recibe 429 RATE_LIMITED;
 *  - /auth/verify-email → ídem (400 por token basura, 3ª → 429);
 *  - /auth/resend-verification → ídem (200 genérico, 3ª → 429);
 *  - /auth/login        → las 5 primeras responden 401 (NO 429: el límite
 *                         no afecta al uso normal bajo el máximo), la 6ª → 429.
 *
 * Imprime líneas ASSERT_OK/ASSERT_FAIL y sale con 0/1. No requiere fixtures
 * (todas las entradas son inválidas a propósito y no crean documentos).
 */

const request = require('supertest');

const app = require('../../src/app');
const { connectDB, disconnectDB } = require('../../src/config/db');

const REG_MAX = 2;
const VER_MAX = 2;
const RES_MAX = 2;
const AUTH_MAX = 5;

const failures = [];
function check(desc, cond, extra) {
  if (cond) {
    // eslint-disable-next-line no-console
    console.log(`ASSERT_OK ${desc}`);
  } else {
    failures.push(desc);
    // eslint-disable-next-line no-console
    console.log(`ASSERT_FAIL ${desc}${extra ? ` :: ${extra}` : ''}`);
  }
}

async function burst(path, body, times) {
  const statuses = [];
  for (let i = 0; i < times; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const res = await request(app).post(path).send(body);
    statuses.push(res.status);
  }
  return statuses;
}

async function main() {
  await connectDB();

  /* /auth/register: válidas pasan (400), excedentes → 429 */
  const reg = await burst('/api/v1/auth/register', {
    inviteToken: 'token-basura-suficientemente-largo-000000',
    firstName: 'X',
    lastName: 'Y',
    email: 'probe.reg@ejemplo.mx',
    password: 'Fuerza123!',
    passwordConfirm: 'Fuerza123!',
  }, REG_MAX + 1);
  check('register: bajo el límite responde 4xx de servicio (no 429)',
    reg.slice(0, REG_MAX).every((s) => s >= 400 && s < 500 && s !== 429), JSON.stringify(reg));
  check('register: al exceder responde 429 RATE_LIMITED', reg[REG_MAX] === 429, JSON.stringify(reg));

  /* /auth/verify-email */
  const ver = await burst('/api/v1/auth/verify-email', { token: 'token-basura-suficiente-0000000000' }, VER_MAX + 1);
  check('verify-email: bajo el límite responde 400 (no 429)',
    ver.slice(0, VER_MAX).every((s) => s === 400), JSON.stringify(ver));
  check('verify-email: al exceder responde 429 RATE_LIMITED', ver[VER_MAX] === 429, JSON.stringify(ver));

  /* /auth/resend-verification */
  const res1 = await burst('/api/v1/auth/resend-verification', { email: 'probe.resend@ejemplo.mx' }, RES_MAX + 1);
  check('resend: bajo el límite responde 200 (no 429)',
    res1.slice(0, RES_MAX).every((s) => s === 200), JSON.stringify(res1));
  check('resend: al exceder responde 429 RATE_LIMITED', res1[RES_MAX] === 429, JSON.stringify(res1));

  /* /auth/login: uso normal NO debe recibir 429 por debajo del máximo */
  const log = await burst('/api/v1/auth/login', { email: 'no.existe@ejemplo.mx', password: 'Mal12345!' }, AUTH_MAX + 1);
  check('login: uso normal bajo el máximo responde 401 (nunca 429)',
    log.slice(0, AUTH_MAX).every((s) => s === 401), JSON.stringify(log));
  check('login: al exceder responde 429 RATE_LIMITED', log[AUTH_MAX] === 429, JSON.stringify(log));

  await disconnectDB();
  if (failures.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`PROBE_RESULT_FAIL ${failures.length} fallo(s)`);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log('PROBE_RESULT_OK');
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.log(`PROBE_RESULT_FAIL excepción: ${err && err.stack}`);
  process.exit(1);
});
