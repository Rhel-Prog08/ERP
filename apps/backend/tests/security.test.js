'use strict';

/**
 * tests/security.test.js — SEGURIDAD DE CUENTAS (FASE F, ETAPA 1)
 *
 * Al igual que registration.test.js, fija el entorno del doble de correo
 * ANTES de cargar la app (este archivo debe cargarse justo después de
 * registration.test en tests/index.js; en ejecución suelta surte el mismo
 * efecto porque el preamble corre antes de los requires de src/).
 *
 * Contenido:
 *  A) RESPUESTAS SIN FUGAS: el flujo completo (invitación → registro →
 *     verificación → login → refresh) no devuelve jamás tokens de
 *     invitación/verificación, contraseñas en claro ni hashes en ningún
 *     cuerpo; los errores no filtran stack traces.
 *  B) GET /users nunca expone password/tokenHash/refreshTokens.
 *  C) Cambio de contraseña → revocación de TODAS las sesiones (refresh).
 *  D) Aislamiento multiempresa de usuarios sin regresiones.
 *  E) PROBES EN PROCESO HIJO (límites 429 controlados, bloqueo de
 *     registro, MAIL_PROVIDER=none e higiene de logs) lanzados con
 *     spawnSync y verificados por su código de salida y marcadores.
 */

// Entorno del doble de correo para ejecuciones sueltas (en la suite
// integrada registration.test ya lo fijó al cargarse primero).
process.env.MAIL_PROVIDER = 'test';
process.env.REGISTRATION_ENABLED = 'true';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const request = require('supertest');

const app = require('../src/app');
const api = request(app);
const { setup, teardown, login, loginRaw, assertOk, assertError } = require('./helpers');
const User = require('../src/modules/users/model');
const Company = require('../src/modules/companies/model');
const Role = require('../src/modules/roles/model');
const Invitation = require('../src/modules/registration/model');
const { drainTestOutbox } = require('../src/utils/mailer');
const { ROLE_PERMISSIONS } = require('../src/config/constants');

const PROBES = path.join(__dirname, 'probes');

/** Lanza un probe como proceso hijo con entorno controlado y lo valida. */
function runProbe(script, envOverrides = {}) {
  const res = spawnSync(process.execPath, [path.join(PROBES, script)], {
    env: { ...process.env, ...envOverrides },
    encoding: 'utf8',
    timeout: 120000,
  });
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  assert.equal(res.status, 0, `probe ${script} salió con ${res.status}:\n${out.slice(-2000)}`);
  assert.match(out, /PROBE_RESULT_OK/, `probe ${script} no confirmó PROBE_RESULT_OK:\n${out.slice(-2000)}`);
  const fails = out.split('\n').filter((l) => l.startsWith('ASSERT_FAIL'));
  assert.equal(fails.length, 0, `probe ${script} con fallos:\n${fails.join('\n')}`);
  return out;
}

function tokenFromLastMail(kind) {
  const outbox = drainTestOutbox();
  const msg = outbox[outbox.length - 1];
  assert.ok(msg, `el doble de correo debía retener el mensaje de ${kind}`);
  const m = msg.text.match(new RegExp(`${kind}\\?token=([A-Za-z0-9_-]+)`));
  assert.ok(m, `el correo de ${kind} debía incluir el enlace con token`);
  return m[1];
}

describe('SEGURIDAD — fugas, sesiones y probes de lanzamiento (FASE F)', () => {
  let fx;
  let adminToken;

  before(async () => {
    fx = await setup();
    drainTestOutbox();
    adminToken = await login(api, fx.admin.email, fx.admin.password);
  });

  after(teardown);

  /* ------------------- A) RESPUESTAS SIN FUGAS ----------------------- */

  it('flujo completo — ningún cuerpo devuelve tokens de invitación/verificación, contraseñas ni hashes', async () => {
    const bodies = [];

    const inv = await api
      .post('/api/v1/users/invitations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'fugas@ejemplo.mx', firstName: 'Sin', lastName: 'Fugas', roleId: fx.roles.Consulta._id });
    assertOk(inv, 201);
    bodies.push(JSON.stringify(inv.body));
    const inviteToken = tokenFromLastMail('registro');

    const reg = await api.post('/api/v1/auth/register').send({
      inviteToken,
      firstName: 'Sin',
      lastName: 'Fugas',
      email: 'fugas@ejemplo.mx',
      password: 'Fuerza123!',
      passwordConfirm: 'Fuerza123!',
    });
    assertOk(reg, 201);
    bodies.push(JSON.stringify(reg.body));
    const verifyToken = tokenFromLastMail('verificar');

    const ver = await api.post('/api/v1/auth/verify-email').send({ token: verifyToken });
    assertOk(ver, 200);
    bodies.push(JSON.stringify(ver.body));

    const loginRes = await api.post('/api/v1/auth/login').send({ email: 'fugas@ejemplo.mx', password: 'Fuerza123!' });
    assertOk(loginRes, 200);
    bodies.push(JSON.stringify(loginRes.body));

    const refreshRes = await api.post('/api/v1/auth/refresh').send({ refreshToken: loginRes.body.data.refreshToken });
    assertOk(refreshRes, 200);
    bodies.push(JSON.stringify(refreshRes.body));

    const doc = await User.findOne({ email: 'fugas@ejemplo.mx' }).select('+password').lean();

    for (const [desc, secret] of [
      ['token de invitación', inviteToken],
      ['token de verificación', verifyToken],
      ['contraseña en claro', 'Fuerza123!'],
      ['hash bcrypt', doc.password],
    ]) {
      for (let i = 0; i < bodies.length; i += 1) {
        assert.ok(!bodies[i].includes(secret), `el cuerpo #${i} filtró ${desc}`);
      }
    }

    // Los errores no filtran stack traces ni detalles internos.
    const bad = await api.post('/api/v1/auth/verify-email').send({ token: `${verifyToken}x` });
    assertError(bad, 400, 'VALIDATION_ERROR');
    assert.ok(!('stack' in bad.body.error), 'la respuesta de error no debe incluir stack');
    assert.ok(!('stack' in bad.body), 'el sobre de error no debe incluir stack');
  });

  it('GET /users — lista y detalle nunca exponen password, tokenHash ni refreshTokens', async () => {
    const alta = await api
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Consulta',
        lastName: 'SinFugas',
        email: 'sin.fugas@ejemplo.mx',
        password: 'Consulta123!',
        roleId: fx.roles.Consulta._id,
      });
    assertOk(alta, 201);

    const lista = await api.get('/api/v1/users?limit=100').set('Authorization', `Bearer ${adminToken}`);
    assertOk(lista, 200);
    const detalle = await api.get(`/api/v1/users/${alta.body.data._id}`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(detalle, 200);

    for (const cuerpo of [JSON.stringify(lista.body), JSON.stringify(detalle.body), JSON.stringify(alta.body)]) {
      assert.ok(!cuerpo.includes('$2a$') && !cuerpo.includes('$2b$') && !cuerpo.includes('$2y$'), 'sin hash bcrypt');
      assert.ok(!cuerpo.includes('tokenHash'), 'sin tokenHash');
      assert.ok(!cuerpo.includes('refreshTokens'), 'sin refreshTokens');
      assert.ok(!cuerpo.includes('"password"'), 'sin campo password');
    }
  });

  /* -------------- C) REVOCACIÓN DE SESIONES AL CAMBIAR ---------------- */

  it('change-password — revoca TODAS las sesiones y obliga a re-login con la nueva contraseña', async () => {
    const alta = await api
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Sesiones',
        lastName: 'Multi',
        email: 'sesiones@ejemplo.mx',
        password: 'Original123!',
        roleId: fx.roles.Consulta._id,
      });
    assertOk(alta, 201);

    const sesionA = await loginRaw(api, 'sesiones@ejemplo.mx', 'Original123!');
    const sesionB = await loginRaw(api, 'sesiones@ejemplo.mx', 'Original123!');
    assert.ok(sesionA.accessToken && sesionB.accessToken, 'dos sesiones activas');

    const cambio = await api
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${sesionA.accessToken}`)
      .send({ currentPassword: 'Original123!', newPassword: 'NuevaClave123!' });
    assertOk(cambio, 200);

    const refreshA = await api.post('/api/v1/auth/refresh').send({ refreshToken: sesionA.refreshToken });
    assertError(refreshA, 401, 'AUTHENTICATION_ERROR', 'la sesión que cambió la contraseña también queda revocada');
    const refreshB = await api.post('/api/v1/auth/refresh').send({ refreshToken: sesionB.refreshToken });
    assertError(refreshB, 401, 'AUTHENTICATION_ERROR', 'las demás sesiones quedan revocadas');

    const loginVieja = await api.post('/api/v1/auth/login').send({ email: 'sesiones@ejemplo.mx', password: 'Original123!' });
    assertError(loginVieja, 401, 'AUTHENTICATION_ERROR');
    const loginNueva = await api.post('/api/v1/auth/login').send({ email: 'sesiones@ejemplo.mx', password: 'NuevaClave123!' });
    assertOk(loginNueva, 200);
  });

  /* ---------------- D) MULTEMPRESA DE USUARIOS ------------------------ */

  it('MULTIEMPRESA usuarios — listados aislados, cross-company 404 sin filtrar datos y 401 sin token', async () => {
    const betaCompany = await Company.create({
      name: 'Empresa Beta Seg',
      legalName: 'Beta Seg S.L.',
      taxId: 'BS-44444444',
      email: 'betaseg@test.local',
      status: 'active',
    });
    const betaRole = await Role.create({
      name: 'Administrador',
      companyId: betaCompany._id,
      permissions: ROLE_PERMISSIONS.Administrador,
      isSystem: true,
      status: 'active',
    });
    await User.create({
      firstName: 'Admin',
      lastName: 'BetaSeg',
      email: 'admin-betaseg@test.local',
      password: 'Admin12345!',
      roleId: betaRole._id,
      companyId: betaCompany._id,
    });
    const betaToken = await login(api, 'admin-betaseg@test.local', 'Admin12345!');

    const betaList = await api.get('/api/v1/users?limit=100').set('Authorization', `Bearer ${betaToken}`);
    assertOk(betaList, 200);
    assert.ok(betaList.body.data.items.length > 0);
    assert.ok(betaList.body.data.items.every((u) => String(u.companyId) === String(betaCompany._id)));

    const alphaUser = await User.findOne({ email: 'sin.fugas@ejemplo.mx' }).lean();
    const cross = await api.get(`/api/v1/users/${alphaUser._id}`).set('Authorization', `Bearer ${betaToken}`);
    assertError(cross, 404, 'NOT_FOUND');
    assert.ok(!JSON.stringify(cross.body).includes('@'), 'el 404 no debe filtrar datos del usuario ajeno');

    const sinToken = await api.get('/api/v1/users');
    assertError(sinToken, 401, 'AUTHENTICATION_ERROR');
  });

  /* ---------------- E) PROBES EN PROCESO HIJO ------------------------ */

  it('PROBE límites — 429 real en register/verify/resend con límites controlados; login sin bloqueos indebidos', () => {
    const out = runProbe('limits-probe.js', {
      MAIL_PROVIDER: 'test',
      REGISTRATION_ENABLED: 'true',
      TEST_RATE_LIMIT_REGISTER_MAX: '2',
      TEST_RATE_LIMIT_VERIFY_MAX: '2',
      TEST_RATE_LIMIT_RESEND_MAX: '2',
      TEST_RATE_LIMIT_AUTH_MAX: '5',
    });
    const okLines = out.split('\n').filter((l) => l.startsWith('ASSERT_OK'));
    assert.ok(okLines.length >= 8, `se esperaban ≥8 afirmaciones del probe:\n${out}`);
  });

  it('PROBE registro público — 429 real en /auth/register-company con límites controlados', () => {
    const out = runProbe('register-company-probe.js', {
      MAIL_PROVIDER: 'test',
      REGISTRATION_ENABLED: 'true',
      TEST_RATE_LIMIT_REGISTER_MAX: '2',
    });
    const okLines = out.split('\n').filter((l) => l.startsWith('ASSERT_OK'));
    assert.ok(okLines.length >= 3, `se esperaban ≥3 afirmaciones del probe:\n${out}`);
  });

  it('PROBE config — REGISTRATION_ENABLED=false bloquea el alta pública pero deja vivos verify/resend', () => {
    runProbe('config-probe.js', { PROBE_MODE: 'register-disabled', REGISTRATION_ENABLED: 'false', MAIL_PROVIDER: 'test' });
  });

  it('PROBE config — REGISTRATION_ENABLED=true SIN proveedor (MAIL_PROVIDER=none) NO permite altas ni invitaciones', () => {
    runProbe('config-probe.js', { PROBE_MODE: 'no-provider', REGISTRATION_ENABLED: 'true', MAIL_PROVIDER: 'none' });
  });

  it('PROBE logs — tokens, contraseñas, hashes y secretos NO aparecen en stdout/stderr del flujo real', () => {
    runProbe('log-scrub-probe.js', { REGISTRATION_ENABLED: 'true', MAIL_PROVIDER: 'test' });
  });
});
