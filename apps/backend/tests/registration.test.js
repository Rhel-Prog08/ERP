'use strict';

/**
 * tests/registration.test.js — REGISTRO Y VERIFICACIÓN DE CUENTAS (FASE E, ETAPA 2)
 *
 * ANTES de cualquier require de src/: este archivo debe cargarse el PRIMERO
 * en tests/index.js para que env.js (que se cachea en su primer require)
 * lea MAIL_PROVIDER=test y REGISTRATION_ENABLED=true. Así el doble de
 * pruebas del mailer opera sin enviar NINGÚN correo real, y el registro
 * por invitación queda habilitado únicamente durante la suite.
 *
 * Cubre:
 *  - endpoints de invitación (POST/GET/DELETE /users/invitations) y de
 *    registro público (POST /auth/register, /auth/verify-email,
 *    /auth/resend-verification);
 *  - tokens: generación criptográfica, SÓLO hash SHA-256 en BD, un solo
 *    uso, caducidad (verificación) y revocación (invitaciones);
 *  - sin autoasignación de privilegios: rol y empresa los elige el invitador;
 *  - aislamiento multiempresa en invitaciones y altas;
 *  - protección de enumeración (respuesta idéntica existente/inexistente);
 *  - contraseñas con hash bcrypt (nunca en claro);
 *  - bloqueo de login sin verificar y de cuentas desactivadas + revocación
 *    de sesiones (refresh tokens);
 *  - .env.example mantiene REGISTRATION_ENABLED=false (producción inerte).
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');

// Fijar el entorno del doble de pruebas ANTES de cargar la app.
process.env.MAIL_PROVIDER = 'test';
process.env.REGISTRATION_ENABLED = 'true';

const app = require('../src/app');
const api = request(app);
const { setup, teardown, login, loginRaw, assertOk, assertError } = require('./helpers');
const User = require('../src/modules/users/model');
const Company = require('../src/modules/companies/model');
const Role = require('../src/modules/roles/model');
const Invitation = require('../src/modules/registration/model');
const { generateToken, hashToken } = require('../src/utils/tokens');
const { drainTestOutbox } = require('../src/utils/mailer');
const { ROLE_PERMISSIONS } = require('../src/config/constants');

const API_INV = '/api/v1/users/invitations';
const GENERIC_RESEND = require('../src/modules/registration/service').RESEND_GENERIC_MESSAGE;

/** Extrae el token opaco de un enlace /registro?token=… o /verificar?token=… */
function tokenFromOutbox(index = -1) {
  const outbox = drainTestOutbox();
  const msg = outbox[index === -1 ? outbox.length - 1 : index];
  assert.ok(msg, 'el doble de pruebas debía retener el mensaje en su buzón');
  const m = msg.text.match(/token=([A-Za-z0-9_-]+)/);
  assert.ok(m, `el correo debía incluir un enlace con token: ${msg.text}`);
  return { token: m[1], outbox, msg };
}

describe('CUENTAS — registro, invitaciones y verificación (FASE E)', () => {
  let fx;
  let adminToken;
  let consultaToken;
  let beta;
  let inviteToken;
  let inviteId;
  let verifyToken;
  let registeredEmail = 'nuevo.usuario@ejemplo.mx';

  before(async () => {
    fx = await setup();
    drainTestOutbox(); // buzón limpio
    adminToken = await login(api, fx.admin.email, fx.admin.password);
    consultaToken = await login(api, fx.consulta.email, fx.consulta.password);

    // Empresa Beta con Administrador y rol propio.
    const betaCompany = await Company.create({
      name: 'Empresa Beta',
      legalName: 'Empresa Beta S.L.',
      taxId: 'B-22222222',
      email: 'beta@test.local',
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
      lastName: 'Beta',
      email: 'admin-beta@test.local',
      password: 'Admin12345!',
      roleId: betaRole._id,
      companyId: betaCompany._id,
    });
    const betaToken = await login(api, 'admin-beta@test.local', 'Admin12345!');
    beta = { companyId: String(betaCompany._id), roleId: String(betaRole._id), token: betaToken };
  });

  after(teardown);

  it('.env.example mantiene REGISTRATION_ENABLED=false (producción inerte sin proveedor)', () => {
    const envExample = fs.readFileSync(path.join(__dirname, '..', '..', '..', '.env.example'), 'utf8');
    assert.match(envExample, /REGISTRATION_ENABLED=false/);
    assert.match(envExample, /MAIL_PROVIDER=none/);
  });

  it('POST /users/invitations — crea invitación, envía correo simulado y NO expone el token', async () => {
    const res = await api
      .post(API_INV)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: registeredEmail, firstName: 'Nuevo', lastName: 'Usuario', roleId: fx.roles.Consulta._id });
    assertOk(res, 201);
    assert.equal(res.body.data.email, registeredEmail);
    inviteId = String(res.body.data._id);
    assert.ok(!JSON.stringify(res.body).includes('token'), 'la respuesta no debe contener el token');

    const { token, outbox } = tokenFromOutbox();
    inviteToken = token;
    assert.equal(outbox.length, 1, 'el doble de pruebas debía retener UN mensaje');
    assert.match(outbox[0].text, /\/registro\?token=/, 'el correo de invitación debe enlazar a /registro');

    const doc = await Invitation.findById(inviteId).select('+tokenHash').lean();
    assert.equal(doc.tokenHash, hashToken(inviteToken), 'en BD debe vivir SÓLO el hash SHA-256');
    assert.notEqual(doc.tokenHash, inviteToken);
    assert.ok(!('token' in doc), 'el documento no debe guardar el token en claro');
    assert.ok(doc.expiresAt.getTime() > Date.now() + 6 * 24 * 60 * 60 * 1000, 'caduca en ~7 días');
    assert.equal(String(doc.companyId), fx.companyId);
    assert.equal(String(doc.invitedBy), fx.admin.id);
  });

  it('POST /users/invitations — duplicados y rol ajeno → 409 / 400', async () => {
    const duplicada = await api
      .post(API_INV)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: registeredEmail, firstName: 'Nuevo', lastName: 'Usuario', roleId: fx.roles.Consulta._id });
    assertError(duplicada, 409, 'CONFLICT');

    const yaRegistrado = await api
      .post(API_INV)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: fx.admin.email, firstName: 'X', lastName: 'Y', roleId: fx.roles.Consulta._id });
    assertError(yaRegistrado, 409, 'CONFLICT');

    const rolAjeno = await api
      .post(API_INV)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'rol.ajeno@ejemplo.mx', firstName: 'Rol', lastName: 'Ajeno', roleId: beta.roleId });
    assertError(rolAjeno, 400, 'VALIDATION_ERROR');
  });

  it('GET /users/invitations — listado, filtro de estado y aislamiento multiempresa', async () => {
    const lista = await api.get(API_INV).set('Authorization', `Bearer ${adminToken}`);
    assertOk(lista, 200);
    assert.equal(lista.body.data.items.length, 1);
    assert.ok(!JSON.stringify(lista.body.data).includes('tokenHash'), 'el hash no debe exponerse en el listado');

    const pendientes = await api.get(`${API_INV}?status=pending`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(pendientes, 200);
    assert.equal(pendientes.body.data.items.length, 1);

    const betaList = await api.get(API_INV).set('Authorization', `Bearer ${beta.token}`);
    assertOk(betaList, 200);
    assert.equal(betaList.body.data.items.length, 0, 'Beta no debe ver invitaciones de Alfa');
  });

  it('RBAC invitaciones — Consulta lee pero no crea ni revoca', async () => {
    const lee = await api.get(API_INV).set('Authorization', `Bearer ${consultaToken}`);
    assertOk(lee, 200);

    const crea = await api
      .post(API_INV)
      .set('Authorization', `Bearer ${consultaToken}`)
      .send({ email: 'otro@ejemplo.mx', firstName: 'Otro', lastName: 'Mas', roleId: fx.roles.Consulta._id });
    assertError(crea, 403, 'AUTHORIZATION_ERROR');

    const revoca = await api.delete(`${API_INV}/${inviteId}`).set('Authorization', `Bearer ${consultaToken}`);
    assertError(revoca, 403, 'AUTHORIZATION_ERROR');

    const sinToken = await api.get(API_INV);
    assertError(sinToken, 401, 'AUTHENTICATION_ERROR');
  });

  it('DELETE /users/invitations/:id — revocación; el token revocado no registra; reinvitar funciona', async () => {
    const revoca = await api.delete(`${API_INV}/${inviteId}`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(revoca, 200);
    assert.equal(revoca.body.data.status, 'revoked');

    const registroRevocada = await api
      .post('/api/v1/auth/register')
      .send({
        inviteToken,
        firstName: 'Nuevo',
        lastName: 'Usuario',
        email: registeredEmail,
        password: 'Fuerza123!',
        passwordConfirm: 'Fuerza123!',
      });
    assertError(registroRevocada, 400, 'VALIDATION_ERROR');
    assert.equal(registroRevocada.body.error.message, 'La invitación no es válida o ha caducado');

    // La revocación libera el correo para una nueva invitación.
    drainTestOutbox();
    const reinvita = await api
      .post(API_INV)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: registeredEmail, firstName: 'Nuevo', lastName: 'Usuario', roleId: fx.roles.Consulta._id });
    assertOk(reinvita, 201);
    inviteId = String(reinvita.body.data._id);
    const { token } = tokenFromOutbox();
    inviteToken = token;
  });

  it('POST /auth/register — registro con invitación: 201, correo simulado y sin autoasignación', async () => {
    const res = await api
      .post('/api/v1/auth/register')
      .send({
        inviteToken,
        firstName: 'Nuevo',
        lastName: 'Usuario',
        email: registeredEmail.toUpperCase(), // se normaliza a minúsculas
        password: 'Fuerza123!',
        passwordConfirm: 'Fuerza123!',
        // Intento de autoasignación: el esquema no los acepta.
        roleId: fx.roles.Administrador._id,
        companyId: beta.companyId,
      });
    assertOk(res, 201);
    assert.equal(res.body.data.emailSent, true, 'el doble de pruebas simuló el envío');
    assert.ok(!JSON.stringify(res.body).includes(inviteToken), 'la respuesta no debe contener el token de invitación');

    const { token, outbox } = tokenFromOutbox();
    verifyToken = token;
    assert.equal(outbox.length, 1);
    assert.match(outbox[0].text, /\/verificar\?token=/, 'el correo de verificación debe enlazar a /verificar');

    const user = await User.findOne({ email: registeredEmail }).select('+password +emailVerification').lean();
    assert.ok(user, 'el usuario debía quedar creado');
    assert.equal(String(user.companyId), fx.companyId, 'la empresa la fija la invitación');
    assert.equal(String(user.roleId), String(fx.roles.Consulta._id), 'el rol lo fija la invitación (sin autoasignación)');
    assert.equal(user.verificationRequired, true, 'el registro público queda pendiente de verificar');
    assert.equal(user.emailVerifiedAt, null);
    assert.equal(user.emailVerification.tokenHash, hashToken(verifyToken), 'sólo el hash del token de verificación');

    const invitacion = await Invitation.findById(inviteId).lean();
    assert.equal(invitacion.status, 'used');
    assert.ok(invitacion.usedAt, 'la invitación queda consumida (un solo uso)');
  });

  it('Contraseña — hash bcrypt en BD, nunca texto plano', async () => {
    const user = await User.findOne({ email: registeredEmail }).select('+password').lean();
    assert.match(user.password, /^\$2[aby]\$\d{2}\$/, 'formato de hash bcrypt');
    assert.notEqual(user.password, 'Fuerza123!');
    assert.ok(!user.password.includes('Fuerza123!'));
  });

  it('Login sin verificar → 401; con token válido → 200 y emailVerified=true; reutilizar token → 400', async () => {
    const sinVerificar = await api
      .post('/api/v1/auth/login')
      .send({ email: registeredEmail, password: 'Fuerza123!' });
    assertError(sinVerificar, 401, 'AUTHENTICATION_ERROR');

    const verifica = await api.post('/api/v1/auth/verify-email').send({ token: verifyToken });
    assertOk(verifica, 200);

    const loginOk = await api.post('/api/v1/auth/login').send({ email: registeredEmail, password: 'Fuerza123!' });
    assertOk(loginOk, 200);
    assert.equal(loginOk.body.data.user.emailVerified, true);

    const reutiliza = await api.post('/api/v1/auth/verify-email').send({ token: verifyToken });
    assertError(reutiliza, 400, 'VALIDATION_ERROR', 'el token es de un solo uso');
  });

  it('Tokens de verificación — inválido y caducado responden 400 genérico', async () => {
    const invalido = await api.post('/api/v1/auth/verify-email').send({ token: generateToken() });
    assertError(invalido, 400, 'VALIDATION_ERROR');

    // Nueva invitación + registro para probar la caducidad.
    drainTestOutbox();
    const invite = await api
      .post(API_INV)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'caduca@ejemplo.mx', firstName: 'Caduca', lastName: 'Pronto', roleId: fx.roles.Consulta._id });
    assertOk(invite, 201);
    const { token: invite2 } = tokenFromOutbox();
    const reg = await api
      .post('/api/v1/auth/register')
      .send({
        inviteToken: invite2,
        firstName: 'Caduca',
        lastName: 'Pronto',
        email: 'caduca@ejemplo.mx',
        password: 'Fuerza123!',
        passwordConfirm: 'Fuerza123!',
      });
    assertOk(reg, 201);
    const { token: verify2 } = tokenFromOutbox();

    await User.updateOne(
      { email: 'caduca@ejemplo.mx' },
      { $set: { 'emailVerification.expiresAt': new Date(Date.now() - 1000) } }
    );
    const caducado = await api.post('/api/v1/auth/verify-email').send({ token: verify2 });
    assertError(caducado, 400, 'VALIDATION_ERROR');
    assert.match(caducado.body.error.message, /caducado/i);
  });

  it('Registro — correo ajeno a la invitación, contraseña débil y confirmación no coincidente → 400', async () => {
    const emailAjeno = await api
      .post('/api/v1/auth/register')
      .send({
        inviteToken: generateToken(),
        firstName: 'X',
        lastName: 'Y',
        email: 'ajeno@ejemplo.mx',
        password: 'Fuerza123!',
        passwordConfirm: 'Fuerza123!',
      });
    assertError(emailAjeno, 400, 'VALIDATION_ERROR');

    drainTestOutbox();
    const invite = await api
      .post(API_INV)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'debil@ejemplo.mx', firstName: 'Debil', lastName: 'Prueba', roleId: fx.roles.Consulta._id });
    assertOk(invite, 201);
    const { token: inviteDebil } = tokenFromOutbox();

    const sinNumero = await api
      .post('/api/v1/auth/register')
      .send({
        inviteToken: inviteDebil,
        firstName: 'Debil',
        lastName: 'Prueba',
        email: 'debil@ejemplo.mx',
        password: 'sololetrass',
        passwordConfirm: 'sololetrass',
      });
    assertError(sinNumero, 400, 'VALIDATION_ERROR');

    const confirmMal = await api
      .post('/api/v1/auth/register')
      .send({
        inviteToken: inviteDebil,
        firstName: 'Debil',
        lastName: 'Prueba',
        email: 'debil@ejemplo.mx',
        password: 'Fuerza123!',
        passwordConfirm: 'Fuerza456!',
      });
    assertError(confirmMal, 400, 'VALIDATION_ERROR');
  });

  it('POST /auth/resend-verification — respuesta idéntica existente/inexistente (sin enumeración) y con enfriamiento', async () => {
    // Cuenta PENDIENTE de verificar creada aquí mismo (registeredEmail ya
    // verificó antes y su subdoc emailVerification es null).
    const pendEmail = 'pendiente@ejemplo.mx';
    drainTestOutbox();
    const invite = await api
      .post(API_INV)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: pendEmail, firstName: 'Pendiente', lastName: 'Verificar', roleId: fx.roles.Consulta._id });
    assertOk(invite, 201);
    const { token: invitePend } = tokenFromOutbox();
    const reg = await api
      .post('/api/v1/auth/register')
      .send({
        inviteToken: invitePend,
        firstName: 'Pendiente',
        lastName: 'Verificar',
        email: pendEmail,
        password: 'Fuerza123!',
        passwordConfirm: 'Fuerza123!',
      });
    assertOk(reg, 201);
    drainTestOutbox();

    // sentAt retrocedido (fuerza el reenvío simulado superando el enfriamiento).
    await User.updateOne(
      { email: pendEmail },
      { $set: { 'emailVerification.sentAt': new Date(Date.now() - 10 * 60 * 1000) } }
    );

    const pendiente = await api.post('/api/v1/auth/resend-verification').send({ email: pendEmail });
    assertOk(pendiente, 200);
    const inexistente = await api.post('/api/v1/auth/resend-verification').send({ email: 'nadie@ejemplo.mx' });
    assertOk(inexistente, 200);

    assert.deepEqual(
      pendiente.body,
      inexistente.body,
      'la respuesta debe ser idéntica exista o no la cuenta (anti-enumeración)'
    );
    assert.equal(pendiente.body.data.message, GENERIC_RESEND);
    assert.equal(drainTestOutbox().length, 1, 'sólo se simuló el envío a la cuenta pendiente');

    // Enfriamiento por cuenta: el segundo reenvío inmediato no envía nada.
    const otraVez = await api.post('/api/v1/auth/resend-verification').send({ email: pendEmail });
    assertOk(otraVez, 200);
    assert.deepEqual(otraVez.body, inexistente.body);
    assert.equal(drainTestOutbox().length, 0, 'el enfriamiento bloqueó el segundo envío');
  });

  it('MULTIEMPRESA — una invitación de Beta da acceso SÓLO a Beta; Alfa no gestiona usuarios ajenos', async () => {
    drainTestOutbox();
    const invite = await api
      .post(API_INV)
      .set('Authorization', `Bearer ${beta.token}`)
      .send({ email: 'cruce@ejemplo.mx', firstName: 'Cruce', lastName: 'Beta', roleId: beta.roleId });
    assertOk(invite, 201);
    const { token: inviteBeta } = tokenFromOutbox();

    const reg = await api
      .post('/api/v1/auth/register')
      .send({
        inviteToken: inviteBeta,
        firstName: 'Cruce',
        lastName: 'Beta',
        email: 'cruce@ejemplo.mx',
        password: 'Fuerza123!',
        passwordConfirm: 'Fuerza123!',
      });
    assertOk(reg, 201);

    const user = await User.findOne({ email: 'cruce@ejemplo.mx' }).lean();
    assert.equal(String(user.companyId), beta.companyId, 'la cuenta queda atada a la empresa del invitador');

    // Alfa no puede ni listar ni revocar la invitación de Beta.
    const listaAlpha = await api.get(API_INV).set('Authorization', `Bearer ${adminToken}`);
    assertOk(listaAlpha, 200);
    assert.ok(listaAlpha.body.data.items.every((i) => String(i.companyId) === fx.companyId));

    const revocaAlpha = await api.delete(`${API_INV}/${invite.body.data._id}`).set('Authorization', `Bearer ${adminToken}`);
    assertError(revocaAlpha, 404, 'NOT_FOUND');
  });

  it('Desactivación de cuenta — login y refresh revocados, sesiones cerradas', async () => {
    const alta = await api
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Temporal',
        lastName: 'Prueba',
        email: 'temporal@ejemplo.mx',
        password: 'Temporal123!',
        roleId: fx.roles.Consulta._id,
      });
    assertOk(alta, 201);
    const userId = String(alta.body.data._id);

    const sesion = await loginRaw(api, 'temporal@ejemplo.mx', 'Temporal123!');
    assert.ok(sesion.accessToken && sesion.refreshToken, 'la cuenta activa inicia sesión');

    const baja = await api.delete(`/api/v1/users/${userId}`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(baja, 200);
    assert.equal(baja.body.data.status, 'inactive');

    const refreshViejo = await api.post('/api/v1/auth/refresh').send({ refreshToken: sesion.refreshToken });
    assertError(refreshViejo, 401, 'AUTHENTICATION_ERROR', 'el refresh token queda revocado');

    const loginTrasBaja = await api.post('/api/v1/auth/login').send({ email: 'temporal@ejemplo.mx', password: 'Temporal123!' });
    assertError(loginTrasBaja, 401, 'AUTHENTICATION_ERROR');
    assert.match(loginTrasBaja.body.error.message, /desactivada/i);

    const doc = await User.findById(userId).select('+refreshTokens').lean();
    assert.equal(doc.refreshTokens.length, 0, 'las sesiones del objetivo quedan revocadas');
  });
});
