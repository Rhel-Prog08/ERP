'use strict';

/**
 * tests/probes/register-company-probe.js — PROBE DE LÍMITES DEL REGISTRO
 * PÚBLICO MULTIEMPRESA (FASE H)
 *
 * Se ejecuta como PROCESO HIJO desde tests/security.test.js con
 * TEST_RATE_LIMIT_REGISTER_MAX=2 (sólo válido con NODE_ENV=test).
 *
 * /auth/register-company comparte el limitador con /register, pero al ser
 * un proceso hijo distinto su bucket en memoria es INDEPENDIENTE: se comprueba
 * en aislamiento que
 *   - bajo el límite responde 4xx de validación (cuerpo basura a propósito,
 *     sin crear NINGÚN documento);
 *   - al excederlo responde 429 RATE_LIMITED.
 *
 * Imprime ASSERT_OK/ASSERT_FAIL y sale con 0/1.
 */

const request = require('supertest');

const {
  assertAuthorizedTestConnection,
  getAuthorizedTestUri,
} = require('../db-safety');

const REGCO_MAX = 2;
const PROBE_EMAIL = 'probe.regco.limit@ejemplo.mx';

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

async function runProbe(dependencies = {}) {
  const environment = dependencies.environment || process.env;
  const testMongoUri = getAuthorizedTestUri(environment);
  if (!dependencies.environment) process.env.MONGO_URI = testMongoUri;

  const app = dependencies.app || require('../../src/app');
  const { connectDB, disconnectDB } = dependencies.connectDB
    ? dependencies
    : require('../../src/config/db');
  const Company = dependencies.Company || require('../../src/modules/companies/model');
  const User = dependencies.User || require('../../src/modules/users/model');
  const probeRequest = dependencies.request || request;

  let connectionAttempted = false;
  try {
    connectionAttempted = true;
    const connection = await connectDB(testMongoUri);
    assertAuthorizedTestConnection(testMongoUri, connection);

    // Cuerpo inválido a propósito (faltan companyName/firstName/…): nunca crea
    // documentos, pero consume el cupo del limitador igual que una petición real.
    const statuses = [];
    for (let i = 0; i < REGCO_MAX + 1; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await probeRequest(app)
        .post('/api/v1/auth/register-company')
        .send({ email: PROBE_EMAIL, password: 'Fuerza123!' });
      statuses.push(res.status);
    }
    check('register-company: bajo el límite responde 400 de validación (no 429)',
      statuses.slice(0, REGCO_MAX).every((s) => s === 400), JSON.stringify(statuses));
    check('register-company: al exceder responde 429 RATE_LIMITED',
      statuses[REGCO_MAX] === 429, JSON.stringify(statuses));
    check('register-company: ninguna empresa ni cuenta creadas por el probe',
      (await Company.countDocuments({ email: PROBE_EMAIL })) === 0 &&
        (await User.countDocuments({ email: PROBE_EMAIL })) === 0);

    if (failures.length > 0) {
      throw new Error(`PROBE_RESULT_FAIL ${failures.length} fallo(s)`);
    }
    // eslint-disable-next-line no-console
    console.log('PROBE_RESULT_OK');
  } finally {
    if (connectionAttempted) await disconnectDB();
  }
}

if (require.main === module) {
  runProbe().catch((err) => {
    // eslint-disable-next-line no-console
    console.log(`PROBE_RESULT_FAIL excepción: ${err && err.stack}`);
    process.exitCode = 1;
  });
}

module.exports = { runProbe };
