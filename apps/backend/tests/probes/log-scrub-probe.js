'use strict';

/**
 * tests/probes/log-scrub-probe.js — PROBE DE HIGIENE DE LOGS (FASE F, ETAPA 1)
 *
 * Proceso hijo con MAIL_PROVIDER=test y REGISTRATION_ENABLED=true que:
 *  1. Captura TODO lo que se escribe por stdout/stderr (incluidos los
 *     console.* y morgan) desde ANTES de cargar la app;
 *  2. Ejecuta el flujo real completo por HTTP: login de un admin →
 *     invitación → registro → verificación → login del nuevo usuario →
 *     refresh;
 *  3. Recopila los secretos reales generados por el flujo: token de
 *     invitación y de verificación (extraídos del buzón del doble de
 *     correo), accessToken y refreshToken (respuestas de login), hashes
 *     bcrypt y SHA-256 leídos de BD, y los propios valores de
 *     JWT_SECRET / REFRESH_TOKEN_SECRET;
 *  4. Afirma que NINGUNO de esos secretos aparece en los logs capturados,
 *     y que las líneas [mail] existen con destinatario ENMASCARADO.
 *
 * Imprime ASSERT_OK/ASSERT_FAIL y sale con 0/1.
 */

const {
  assertAuthorizedTestConnection,
  getAuthorizedTestUri,
  runDestructiveTestOperation,
} = require('../db-safety');
const TEST_MONGO_URI = getAuthorizedTestUri();
process.env.MONGO_URI = TEST_MONGO_URI;

/* ---------- captura de logs ANTES de cualquier require de src/ ---------- */
const captured = [];
const origOut = process.stdout.write.bind(process.stdout);
const origErr = process.stderr.write.bind(process.stderr);
process.stdout.write = (chunk) => { captured.push(String(chunk)); return true; };
process.stderr.write = (chunk) => { captured.push(String(chunk)); return true; };

function say(line) {
  origOut(`${line}\n`);
}

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const { connectDB, disconnectDB } = require('../../src/config/db');
const Company = require('../../src/modules/companies/model');
const Role = require('../../src/modules/roles/model');
const User = require('../../src/modules/users/model');
const Invitation = require('../../src/modules/registration/model');
const { ROLE_PERMISSIONS } = require('../../src/config/constants');
const { hashToken } = require('../../src/utils/tokens');
const { drainTestOutbox } = require('../../src/utils/mailer');

const ADMIN_PASS = 'ProbeAdmin123!';
const USER_PASS = 'Fuerza123!';

const failures = [];
function check(desc, cond, extra) {
  if (cond) {
    say(`ASSERT_OK ${desc}`);
  } else {
    failures.push(desc);
    say(`ASSERT_FAIL ${desc}${extra ? ` :: ${extra}` : ''}`);
  }
}

function tokenFromLastMail(kind) {
  const outbox = drainTestOutbox();
  const msg = outbox[outbox.length - 1];
  if (!msg) return null;
  const re = new RegExp(`${kind}\\?token=([A-Za-z0-9_-]+)`);
  const m = msg.text.match(re);
  return m ? m[1] : null;
}

async function main() {
  await connectDB(TEST_MONGO_URI);
  drainTestOutbox();
  const testConnection = mongoose.connection;
  assertAuthorizedTestConnection(TEST_MONGO_URI, testConnection);

  /* Limpieza de fixtures de ejeciones previas (probe idempotente). */
  const prevCompanies = await Company.find({ taxId: 'L-33333333' }).select('_id').lean();
  const prevIds = prevCompanies.map((c) => c._id);
  if (prevIds.length > 0) {
    await runDestructiveTestOperation({
      uri: TEST_MONGO_URI,
      connection: testConnection,
      operation: () => Role.deleteMany({ companyId: { $in: prevIds } }),
    });
    await runDestructiveTestOperation({
      uri: TEST_MONGO_URI,
      connection: testConnection,
      operation: () => Company.deleteMany({ _id: { $in: prevIds } }),
    });
  }
  await runDestructiveTestOperation({
    uri: TEST_MONGO_URI,
    connection: testConnection,
    operation: () => User.deleteMany({ email: { $in: ['logscrub-admin@ejemplo.mx', 'logscrub.user@ejemplo.mx'] } }),
  });
  await runDestructiveTestOperation({
    uri: TEST_MONGO_URI,
    connection: testConnection,
    operation: () => Invitation.deleteMany({ email: 'logscrub.user@ejemplo.mx' }),
  });

  /* ---------------------------- fixtures ----------------------------- */
  const company = await Company.create({
    name: 'Empresa LogScrub',
    legalName: 'LogScrub S.A.',
    taxId: 'L-33333333',
    email: 'logscrub@ejemplo.mx',
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
    firstName: 'Log',
    lastName: 'Scrub',
    email: 'logscrub-admin@ejemplo.mx',
    password: ADMIN_PASS,
    roleId: role._id,
    companyId: company._id,
  });

  const loginAdmin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'logscrub-admin@ejemplo.mx', password: ADMIN_PASS });
  check('fixture: login del admin', loginAdmin.status === 200, String(loginAdmin.status));
  const adminToken = loginAdmin.body.data.accessToken;

  /* ---------------- flujo real: invitación → registro → verify ------- */
  const inv = await request(app)
    .post('/api/v1/users/invitations')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ email: 'logscrub.user@ejemplo.mx', firstName: 'Nuevo', lastName: 'Scrub', roleId: role._id });
  check('flujo: invitación creada (201)', inv.status === 201, String(inv.status));
  const inviteToken = tokenFromLastMail('registro');

  const reg = await request(app).post('/api/v1/auth/register').send({
    inviteToken,
    firstName: 'Nuevo',
    lastName: 'Scrub',
    email: 'logscrub.user@ejemplo.mx',
    password: USER_PASS,
    passwordConfirm: USER_PASS,
  });
  check('flujo: registro aceptado (201)', reg.status === 201, String(reg.status));
  const verifyToken = tokenFromLastMail('verificar');

  // El hash de verificación sólo existe en BD mientras está pendiente:
  // se captura ANTES de verificar (tras verificar, el subdoc es null).
  const pendingDoc = await User.findOne({ email: 'logscrub.user@ejemplo.mx' })
    .select('+emailVerification')
    .lean();
  const verifyTokenHash =
    pendingDoc && pendingDoc.emailVerification && pendingDoc.emailVerification.tokenHash;

  const ver = await request(app).post('/api/v1/auth/verify-email').send({ token: verifyToken });
  check('flujo: verificación aceptada (200)', ver.status === 200, String(ver.status));

  const loginUser = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'logscrub.user@ejemplo.mx', password: USER_PASS });
  check('flujo: login del nuevo usuario (200)', loginUser.status === 200, String(loginUser.status));
  const accessToken = loginUser.body.data.accessToken;
  const refreshToken = loginUser.body.data.refreshToken;

  const ref = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
  check('flujo: refresh aceptado (200)', ref.status === 200, String(ref.status));

  /* --------------------- secretos reales generados -------------------- */
  const userDoc = await User.findOne({ email: 'logscrub.user@ejemplo.mx' }).select('+password +emailVerification').lean();
  const invDoc = await Invitation.findOne({ email: 'logscrub.user@ejemplo.mx' }).select('+tokenHash').lean();
  const secrets = {
    'token de invitación': inviteToken,
    'token de verificación': verifyToken,
    'accessToken JWT': accessToken,
    'refreshToken JWT': refreshToken,
    'contraseña de usuario en claro': USER_PASS,
    'contraseña de admin en claro': ADMIN_PASS,
    'hash bcrypt en BD': userDoc && userDoc.password,
    'hash SHA-256 invitación en BD': invDoc && invDoc.tokenHash,
    'hash SHA-256 verificación en BD': verifyTokenHash,
    'JWT_SECRET': process.env.JWT_SECRET,
    'REFRESH_TOKEN_SECRET': process.env.REFRESH_TOKEN_SECRET,
  };
  const logs = captured.join('');
  for (const [desc, value] of Object.entries(secrets)) {
    check(`logs SIN '${desc}'`, Boolean(value) && !logs.includes(value));
  }

  /* --------------------- afirmaciones positivas ----------------------- */
  check('los logs registran el envío simulado con destinatario enmascarado',
    /\[mail\] invitación → \w\*\*\*@/.test(logs) && /\[mail\] verificación → \w\*\*\*@/.test(logs));

  await disconnectDB();
  process.stdout.write = origOut;
  process.stderr.write = origErr;
  if (failures.length > 0) {
    say(`PROBE_RESULT_FAIL ${failures.length} fallo(s)`);
    process.exit(1);
  }
  say('PROBE_RESULT_OK');
  process.exit(0);
}

main().catch((err) => {
  process.stdout.write = origOut;
  process.stderr.write = origErr;
  say(`PROBE_RESULT_FAIL excepción: ${err && err.stack}`);
  process.exit(1);
});
