'use strict';

/**
 * tests/probes/config-probe.js — PROBE DE CONFIGURACIÓN DE LANZAMIENTO (FASE F)
 *
 * Proceso hijo con una configuración de entorno CONCRETADA por el padre
 * (una combinación por proceso, porque env.js se cachea en el primer require):
 *
 *  MODE=register-disabled  → REGISTRATION_ENABLED=false (+ MAIL_PROVIDER=test):
 *      - POST /auth/register → 503 REGISTRATION_DISABLED (bloqueo explícito
 *        aunque el proveedor de correo funcione);
 *      - POST /auth/verify-email y /auth/resend-verification SIGUEN vivos
 *        (sólo el alta pública debe deshabilitarse).
 *
 *  MODE=no-provider        → REGISTRATION_ENABLED=true + MAIL_PROVIDER=none
 *      (LA COMBINACIÓN PELIGROSA de un lanzamiento sin proveedor):
 *      - POST /auth/register → 503 REGISTRATION_DISABLED (registration exige
 *        correo configurado además del flag);
 *      - POST /users/invitations → 502 MAIL_ERROR con ROLLBACK de la
 *        invitación (queda 'revoked', nunca un 'pending' inutilizable) y sin
 *        fingir envío: la operación que depende del correo NO se confirma.
 *
 * Imprime ASSERT_OK/ASSERT_FAIL y sale con 0/1.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const {
  assertAuthorizedTestConnection,
  getAuthorizedTestUri,
  runDestructiveTestOperation,
} = require('../db-safety');
const TEST_MONGO_URI = getAuthorizedTestUri();
process.env.MONGO_URI = TEST_MONGO_URI;

const app = require('../../src/app');
const { connectDB, disconnectDB } = require('../../src/config/db');
const Company = require('../../src/modules/companies/model');
const Role = require('../../src/modules/roles/model');
const User = require('../../src/modules/users/model');
const Invitation = require('../../src/modules/registration/model');
const { ROLE_PERMISSIONS } = require('../../src/config/constants');
const env = require('../../src/config/env');

const MODE = process.env.PROBE_MODE || '';
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

const REGISTER_BODY = {
  inviteToken: 'token-basura-suficientemente-largo-0000',
  firstName: 'X',
  lastName: 'Y',
  email: 'probe.config@ejemplo.mx',
  password: 'Fuerza123!',
  passwordConfirm: 'Fuerza123!',
};

async function makeAdmin() {
  const company = await Company.create({
    name: 'Empresa Probe',
    legalName: 'Probe S.A.',
    taxId: 'P-11111111',
    email: 'probe@ejemplo.mx',
    status: 'active',
  });
  const role = await Role.create({
    name: 'Administrador',
    companyId: company._id,
    permissions: ROLE_PERMISSIONS.Administrador,
    isSystem: true,
    status: 'active',
  });
  await User.create({
    firstName: 'Probe',
    lastName: 'Admin',
    email: 'probe-admin@ejemplo.mx',
    password: 'Probe12345!',
    roleId: role._id,
    companyId: company._id,
  });
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'probe-admin@ejemplo.mx', password: 'Probe12345!' });
  return { token: login.body.data.accessToken, companyId: String(company._id), roleId: String(role._id) };
}

async function main() {
  await connectDB(TEST_MONGO_URI);

  /* Limpieza de fixtures de ejeciones previas (probe idempotente). */
  const testConnection = mongoose.connection;
  assertAuthorizedTestConnection(TEST_MONGO_URI, testConnection);
  const prev = await Company.find({ taxId: 'P-11111111' }).select('_id').lean();
  const ids = prev.map((c) => c._id);
  if (ids.length > 0) {
    await runDestructiveTestOperation({
      uri: TEST_MONGO_URI,
      connection: testConnection,
      operation: () => Role.deleteMany({ companyId: { $in: ids } }),
    });
    await runDestructiveTestOperation({
      uri: TEST_MONGO_URI,
      connection: testConnection,
      operation: () => Company.deleteMany({ _id: { $in: ids } }),
    });
  }
  await runDestructiveTestOperation({
    uri: TEST_MONGO_URI,
    connection: testConnection,
    operation: () => User.deleteMany({ email: 'probe-admin@ejemplo.mx' }),
  });
  await runDestructiveTestOperation({
    uri: TEST_MONGO_URI,
    connection: testConnection,
    operation: () => Invitation.deleteMany({ email: 'sin-proveedor@ejemplo.mx' }),
  });

  /* --- /auth/register debe estar bloqueado en AMBOS modos --- */
  const reg = await request(app).post('/api/v1/auth/register').send(REGISTER_BODY);
  check(`[${MODE}] register → 503 REGISTRATION_DISABLED`, reg.status === 503 && reg.body.error.code === 'REGISTRATION_DISABLED',
    `${reg.status} ${JSON.stringify(reg.body)}`);
  check(`[${MODE}] la respuesta 503 no filtra tokens`, !JSON.stringify(reg.body).includes('token'));

  /* --- /auth/register-company (registro público multiempresa) TAMBIÉN bloqueado --- */
  const regCo = await request(app).post('/api/v1/auth/register-company').send({
    companyName: 'Empresa Probe Gate',
    firstName: 'Probe',
    lastName: 'Gate',
    email: 'probe.regco@ejemplo.mx',
    password: 'Fuerza123!',
    passwordConfirm: 'Fuerza123!',
  });
  check(`[${MODE}] register-company → 503 REGISTRATION_DISABLED`,
    regCo.status === 503 && regCo.body.error.code === 'REGISTRATION_DISABLED',
    `${regCo.status} ${JSON.stringify(regCo.body)}`);
  check(`[${MODE}] register-company 503 NO crea empresa ni cuenta`,
    (await Company.countDocuments({ name: 'Empresa Probe Gate' })) === 0 &&
      (await User.countDocuments({ email: 'probe.regco@ejemplo.mx' })) === 0);

  if (MODE === 'register-disabled') {
    // Con proveedor 'test' operativo, el flag explícito=false sigue mandando.
    check('[register-disabled] env: REGISTRATION_ENABLED=false', env.registration.enabled === false);
    const ver = await request(app).post('/api/v1/auth/verify-email').send({ token: 'token-basura-suficiente-000000' });
    check('[register-disabled] verify-email sigue vivo (400, no 503)', ver.status === 400, String(ver.status));
    const res = await request(app).post('/api/v1/auth/resend-verification').send({ email: 'cualquiera@ejemplo.mx' });
    check('[register-disabled] resend-verification sigue vivo (200, no 503)', res.status === 200, String(res.status));
  }

  if (MODE === 'no-provider') {
    check('[no-provider] env: mail NO configurado a pesar de REGISTRATION_ENABLED=true',
      env.registration.enabled === false && env.mail.configured === false);

    const admin = await makeAdmin();
    const antes = await Invitation.countDocuments({ companyId: admin.companyId });
    const inv = await request(app)
      .post('/api/v1/users/invitations')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: 'sin-proveedor@ejemplo.mx', firstName: 'Sin', lastName: 'Proveedor', roleId: admin.roleId });
    check('[no-provider] crear invitación sin correo → 502 MAIL_ERROR (no 201)',
      inv.status === 502 && inv.body.error.code === 'MAIL_ERROR', `${inv.status} ${JSON.stringify(inv.body)}`);
    check('[no-provider] la respuesta 502 no filtra el token', !JSON.stringify(inv.body).includes('tokenBasura') && !JSON.stringify(inv.body).match(/token=['"][A-Za-z0-9_-]{16,}/));

    const pendientes = await Invitation.find({ companyId: admin.companyId, status: 'pending' }).lean();
    check('[no-provider] ROLLBACK: ninguna invitación queda pendiente tras el fallo de correo',
      pendientes.length === 0 && (await Invitation.countDocuments({ companyId: admin.companyId })) === antes + 1);
    const revoked = await Invitation.findOne({ companyId: admin.companyId }).lean();
    check('[no-provider] la invitación fallida quedó en estado revoked', revoked && revoked.status === 'revoked',
      revoked && revoked.status);
  }

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
