'use strict';

/**
 * tests/public-registration.test.js — REGISTRO PÚBLICO MULTIEMPRESA (FASE H)
 *
 * ANTES de cualquier require de src/: este archivo fija MAIL_PROVIDER=test y
 * REGISTRATION_ENABLED=true (mismo truco que registration.test.js) para que
 * el doble de correo opere sin enviar NINGÚN mensaje real.
 *
 * Cubre los objetivos de la FASE 5:
 *  5.1 crea empresa + administrador con aprovisionamiento completo (transacción);
 *  5.2 duplicados → 409 y contraseñas/campos inválidos → 400;
 *  5.3 login bloqueado hasta verificar el correo (registro provisional seguro);
 *  5.4 verificación válida, reutilización, caducidad y reenvíos;
 *  5.5 companyId/roleId/permissions/status inyectados por el cliente → ignorados;
 *  5.6 dos empresas con datos completamente aislados;
 *  5.7 cada administrador sólo administra SU empresa (RBAC + aislamiento);
 *  5.8 el registro por invitación sigue intacto junto al público.
 */

process.env.MAIL_PROVIDER = 'test';
process.env.REGISTRATION_ENABLED = 'true';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const api = request(app);
const { setup, teardown, login, assertOk, assertError } = require('./helpers');
const User = require('../src/modules/users/model');
const Company = require('../src/modules/companies/model');
const Role = require('../src/modules/roles/model');
const Warehouse = require('../src/modules/warehouses/model');
const Settings = require('../src/modules/settings/model');
const AuditLog = require('../src/modules/audit/model');
const { hashToken } = require('../src/utils/tokens');
const { drainTestOutbox } = require('../src/utils/mailer');
const { DEFAULT_ROLES, ROLE_PERMISSIONS } = require('../src/config/constants');
const { RESEND_GENERIC_MESSAGE } = require('../src/modules/registration/service');
const { transactionsSupported, withTransaction } = require('../src/config/db');
const companiesService = require('../src/modules/companies/service');

const REGISTER = '/api/v1/auth/register-company';
const VERIFY = '/api/v1/auth/verify-email';
const LOGIN = '/api/v1/auth/login';

/** Extrae el token opaco del último correo simulado (enlace con token=…). */
function lastVerifyToken() {
  const outbox = drainTestOutbox();
  const msg = outbox[outbox.length - 1];
  assert.ok(msg, 'el doble de pruebas debía retener el mensaje en su buzón');
  const m = msg.text.match(/token=([A-Za-z0-9_-]+)/);
  assert.ok(m, `el correo debía incluir un enlace con token: ${msg.text}`);
  return { token: m[1], msg };
}

/** Payload válido por defecto; cada test sobreescribe lo que necesite. */
function regPayload(overrides = {}) {
  return {
    companyName: 'Empresa Gamma',
    firstName: 'Gama',
    lastName: 'Administradora',
    email: 'admin-gamma@test.local',
    password: 'Gamma1234!',
    passwordConfirm: 'Gamma1234!',
    ...overrides,
  };
}

describe('REGISTRO PÚBLICO MULTIEMPRESA — FASE H', () => {
  let fx;
  const gamma = {};
  const delta = {};

  before(async () => {
    fx = await setup();
    drainTestOutbox();
  });

  after(teardown);

  it('el índice parcial permite varios ownerUserId ausentes o null y mantiene unicidad para ObjectId', async () => {
    const indexes = await Company.collection.indexes();
    const ownerIndex = indexes.find((index) => index.key.ownerUserId === 1);
    assert.ok(ownerIndex, 'el índice ownerUserId debe estar creado');
    assert.equal(ownerIndex.unique, true);
    assert.deepEqual(ownerIndex.partialFilterExpression, {
      ownerUserId: { $type: 'objectId' },
    });
    assert.equal(ownerIndex.sparse, undefined);

    const absentOne = await Company.create({ name: 'Sin propietario uno' });
    const absentTwo = await Company.create({ name: 'Sin propietario dos' });
    const nullOne = await Company.create({ name: 'Propietario nulo uno', ownerUserId: null });
    const nullTwo = await Company.create({ name: 'Propietario nulo dos', ownerUserId: null });
    assert.ok(absentOne && absentTwo && nullOne && nullTwo);
    assert.equal(absentOne.ownerUserId, undefined);
    assert.equal(absentTwo.ownerUserId, undefined);
    assert.equal(nullOne.ownerUserId, null);
    assert.equal(nullTwo.ownerUserId, null);
  });

  it('la asignación válida exige usuario de la empresa y bloquea segunda propiedad', async () => {
    await withTransaction((session) =>
      companiesService.assignOwner(fx.companyId, fx.admin.id, session)
    );
    const company = await Company.findById(fx.companyId).lean();
    assert.equal(String(company.ownerUserId), fx.admin.id);
    assert.equal(String((await User.findById(fx.admin.id).lean()).companyId), fx.companyId);

    const secondCompany = await Company.create({ name: 'Segunda empresa del propietario' });
    await assert.rejects(
      withTransaction((session) =>
        companiesService.assignOwner(secondCompany._id, fx.admin.id, session)
      ),
      /misma empresa/
    );
    assert.equal((await Company.findById(secondCompany._id).lean()).ownerUserId, undefined);
  });

  it('el índice parcial impide que el mismo usuario figure como propietario de dos empresas', async () => {
    assert.equal(
      String((await Company.findById(fx.companyId).lean()).ownerUserId),
      fx.admin.id
    );
    await assert.rejects(
      Company.create({ name: 'Segunda empresa del índice', ownerUserId: fx.admin.id }),
      (err) => err && err.code === 11000
    );
    assert.equal(await Company.countDocuments({ name: 'Segunda empresa del índice' }), 0);
  });

  it('rechaza asignar como propietario un usuario de otra empresa', async () => {
    const otherCompany = await Company.create({ name: 'Empresa de usuario ajeno' });
    await assert.rejects(
      withTransaction((session) =>
        companiesService.assignOwner(otherCompany._id, fx.admin.id, session)
      ),
      /misma empresa/
    );
    assert.equal((await Company.findById(otherCompany._id).lean()).ownerUserId, undefined);
  });

  it('PATCH genérico ignora ownerUserId', async () => {
    const previousOwner = (await Company.findById(fx.companyId).lean()).ownerUserId;
    const token = await login(api, fx.admin.email, fx.admin.password);
    const res = await api
      .patch(`/api/v1/companies/${fx.companyId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ownerUserId: fx.admin.id, phone: '5512345678' });
    assertOk(res, 200);

    const company = await Company.findById(fx.companyId).lean();
    assert.equal(company.phone, '5512345678');
    assert.equal(String(company.ownerUserId || ''), String(previousOwner || ''));
  });

  it('5.1 — crea empresa + administrador con aprovisionamiento completo y auditoría', async () => {
    const res = await api.post(REGISTER).send(regPayload());
    assertOk(res, 201);
    assert.equal(res.body.data.company.name, 'Empresa Gamma');
    assert.equal(res.body.data.emailSent, true, 'el doble de correo debía confirmar el envío');
    assert.ok(!JSON.stringify(res.body).includes('token'), 'la respuesta jamás contiene tokens');

    const company = await Company.findOne({ name: 'Empresa Gamma' }).lean();
    assert.ok(company, 'la empresa debía quedar creada');
    gamma.companyId = String(company._id);

    // Aprovisionamiento idéntico a POST /companies: almacén + settings + 6 roles.
    const warehouse = await Warehouse.findOne({ companyId: company._id }).lean();
    assert.equal(warehouse.name, 'Almacén Principal');
    const settings = await Settings.findOne({ companyId: company._id }).lean();
    assert.ok(settings, 'los settings por defecto debían crearse');

    const roles = await Role.find({ companyId: company._id }).lean();
    assert.equal(roles.length, DEFAULT_ROLES.length, 'los 6 roles por defecto de la empresa');
    const adminRole = roles.find((r) => r.name === 'Administrador');
    assert.deepEqual(adminRole.permissions, ROLE_PERMISSIONS.Administrador, 'admin con TODOS los permisos');
    gamma.adminRoleId = String(adminRole._id);

    const admin = await User.findOne({ email: 'admin-gamma@test.local' })
      .select('+password +emailVerification')
      .lean();
    assert.equal(String(admin.companyId), gamma.companyId);
    assert.equal(String(admin.roleId), gamma.adminRoleId);
    assert.equal(admin.status, 'active');
    assert.equal(admin.verificationRequired, true, 'cuenta bloqueada hasta verificar');
    assert.equal(admin.emailVerifiedAt, null);
    assert.equal(String(company.ownerUserId), String(admin._id), 'el primer usuario es el propietario explícito');
    assert.match(admin.password, /^\$2/, 'la contraseña vive hasheada con bcrypt');
    assert.notEqual(admin.password, 'Gamma1234!');

    // El token de verificación sólo existe como hash SHA-256 en BD.
    const { token } = lastVerifyToken();
    gamma.verifyToken = token;
    assert.equal(admin.emailVerification.tokenHash, hashToken(token));
    assert.ok(!JSON.stringify(admin).includes(token), 'el token en claro no vive en la BD');

    // Auditoría atómica en la empresa recién creada.
    const audit = await AuditLog.findOne({
      action: 'REGISTER_COMPANY',
      companyId: company._id,
    }).lean();
    assert.ok(audit, 'la entrada REGISTER_COMPANY debía registrarse en la empresa nueva');
  });

  it('5.5 — companyId/roleId/permissions/status inyectados por el cliente se IGNORAN', async () => {
    const res = await api.post(REGISTER).send({
      ...regPayload({
        companyName: 'Empresa Delta',
        firstName: 'Dana',
        lastName: 'Delta',
        email: 'admin-delta@test.local',
        password: 'Delta1234!',
        passwordConfirm: 'Delta1234!',
      }),
      // Intentos de manipulación: todos deben descartarse en el whitelist.
      companyId: fx.companyId,
      roleId: fx.roles.Ventas._id,
      permissions: ['products:create'],
      role: 'superadmin',
      emailVerifiedAt: new Date().toISOString(),
      verificationRequired: false,
      ownerUserId: fx.admin.id,
    });
    assertOk(res, 201);

    const deltaCompany = await Company.findOne({ name: 'Empresa Delta' }).lean();
    assert.ok(deltaCompany, 'la empresa Delta debía crearse');
    delta.companyId = String(deltaCompany._id);

    const admin = await User.findOne({ email: 'admin-delta@test.local' }).lean();
    assert.equal(String(deltaCompany.ownerUserId), String(admin._id), 'el propietario es el usuario recién creado, no el valor inyectado');
    assert.notEqual(String(admin.companyId), fx.companyId, 'no puede entrar en la empresa Alfa');
    assert.equal(String(admin.companyId), delta.companyId, 'pertenece SÓLO a su empresa nueva');
    const role = await Role.findById(admin.roleId).lean();
    assert.equal(role.name, 'Administrador', 'rol asignado por el servidor');
    assert.equal(String(role.companyId), delta.companyId, 'rol de SU empresa, no de otra');
    assert.equal(admin.permissions, undefined, 'los usuarios no almacenan permisos propios');
    assert.equal(admin.emailVerifiedAt, null, 'la verificación no puede saltarse inyectando la fecha');
    assert.equal(admin.verificationRequired, true, 'el candado de verificación no puede desactivarse');
    assert.equal(String(admin.companyId), String(deltaCompany._id), 'el usuario conserva una sola empresa');
    assert.notEqual(String(deltaCompany.ownerUserId), fx.admin.id, 'una empresa no puede aceptar un propietario ajeno');

    const { token } = lastVerifyToken();
    delta.verifyToken = token;
  });

  it('5.2 — duplicados → 409; contraseñas inválidas y campos faltantes → 400', async () => {
    const dupNew = await api.post(REGISTER).send(regPayload());
    assertError(dupNew, 409, 'CONFLICT');

    const dupExisting = await api.post(REGISTER).send(regPayload({ email: fx.admin.email }));
    assertError(dupExisting, 409, 'CONFLICT');

    const weak = await api
      .post(REGISTER)
      .send(regPayload({ email: 'otra@test.local', password: 'corta', passwordConfirm: 'corta' }));
    assertError(weak, 400, 'VALIDATION_ERROR');
    assert.equal(weak.body.error.details[0].field, 'password');

    const mismatch = await api
      .post(REGISTER)
      .send(regPayload({ email: 'otra@test.local', passwordConfirm: 'Distinta123' }));
    assertError(mismatch, 400, 'VALIDATION_ERROR');
    assert.equal(mismatch.body.error.details[0].field, 'passwordConfirm');

    const noCompany = await api.post(REGISTER).send(regPayload({ email: 'otra2@test.local', companyName: '' }));
    assertError(noCompany, 400, 'VALIDATION_ERROR');

    const badEmail = await api.post(REGISTER).send(regPayload({ email: 'no-es-correo' }));
    assertError(badEmail, 400, 'VALIDATION_ERROR');

    const noNumber = await api
      .post(REGISTER)
      .send(regPayload({ email: 'otra3@test.local', password: 'SinNumeros', passwordConfirm: 'SinNumeros' }));
    assertError(noNumber, 400, 'VALIDATION_ERROR');
    assert.match(noNumber.body.error.details[0].message, /número/i);
  });

  it('5.9 — el fallo al guardar la propiedad revierte empresa, usuario y aprovisionamiento', async () => {
    assert.equal(transactionsSupported(), true, 'esta prueba requiere el replica set local de pruebas');
    const existingCounts = {
      warehouses: await Warehouse.countDocuments(),
      settings: await Settings.countDocuments(),
      roles: await Role.countDocuments(),
    };
    const originalUpdateOne = Company.updateOne;
    Company.updateOne = function updateOneWithOwnerFailure(filter, update, ...args) {
      if (update && update.$set && update.$set.ownerUserId) {
        throw new Error('fallo simulado al persistir propietario');
      }
      return originalUpdateOne.call(this, filter, update, ...args);
    };

    try {
      const failed = await api.post(REGISTER).send(
        regPayload({
          companyName: 'Empresa con fallo de propietario',
          firstName: 'Rollback',
          lastName: 'Propietario',
          email: 'rollback-owner@test.local',
          password: 'Rollback1234!',
          passwordConfirm: 'Rollback1234!',
        })
      );
      assert.equal(failed.status, 500);
      assert.equal(
        await Company.exists({ name: 'Empresa con fallo de propietario' }),
        null,
        'la empresa debe revertirse junto con el propietario'
      );
      assert.equal(await User.exists({ email: 'rollback-owner@test.local' }), null);
      assert.equal(await Warehouse.countDocuments(), existingCounts.warehouses);
      assert.equal(await Settings.countDocuments(), existingCounts.settings);
      assert.equal(await Role.countDocuments(), existingCounts.roles);
    } finally {
      Company.updateOne = originalUpdateOne;
    }
  });

  it('5.3 — login bloqueado antes de verificar (registro provisional seguro)', async () => {
    const res = await api.post(LOGIN).send({ email: 'admin-gamma@test.local', password: 'Gamma1234!' });
    assertError(res, 401, 'AUTHENTICATION_ERROR');
    assert.match(res.body.error.message, /verificar/i);

    // Sin sesión no hay ninguna puerta de entrada a los datos de la empresa.
    const noAuth = await api.get('/api/v1/companies');
    assert.equal(noAuth.status, 401, 'la empresa es inaccesible sin sesión verificada');
  });

  it('5.4 — verificación válida → login; token de un solo uso; caducado → 400; reenvío reactiva', async () => {
    // a) Verificación válida de Gamma.
    const ok = await api.post(VERIFY).send({ token: gamma.verifyToken });
    assertOk(ok, 200);

    // b) Un solo uso: reutilizar el mismo token → error genérico.
    const reuse = await api.post(VERIFY).send({ token: gamma.verifyToken });
    assertError(reuse, 400, 'VALIDATION_ERROR');

    // c) Con la verificación completada el login funciona.
    gamma.token = await login(api, 'admin-gamma@test.local', 'Gamma1234!');
    const me = await api.get('/api/v1/auth/me').set('Authorization', `Bearer ${gamma.token}`);
    assertOk(me, 200);
    assert.equal(me.body.data.emailVerified, true);

    // d) Token caducado (envejecido en BD) → rechazo.
    await User.updateOne(
      { email: 'admin-delta@test.local' },
      { $set: { 'emailVerification.expiresAt': new Date(Date.now() - 60 * 1000) } }
    );
    const expired = await api.post(VERIFY).send({ token: delta.verifyToken });
    assertError(expired, 400, 'VALIDATION_ERROR');

    // e) El reenvío respeta el enfriamiento: uno inmediato responde igual
    //    (genérico) pero NO vuelve a enviar correo (anti-abuso).
    drainTestOutbox();
    const resendFrio = await api
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'admin-delta@test.local' });
    assertOk(resendFrio, 200);
    assert.equal(resendFrio.body.data.message, RESEND_GENERIC_MESSAGE);
    assert.equal(drainTestOutbox().length, 0, 'dentro del enfriamiento no se reenvía correo');

    // Con el enfriamiento vencido (simulado en BD) el reenvío reactiva la
    // ventana con un token nuevo y respuesta SIEMPRE genérica.
    await User.updateOne(
      { email: 'admin-delta@test.local' },
      { $set: { 'emailVerification.sentAt': new Date(Date.now() - 15 * 60 * 1000) } }
    );
    const resend = await api.post('/api/v1/auth/resend-verification').send({ email: 'admin-delta@test.local' });
    assertOk(resend, 200);
    assert.equal(resend.body.data.message, RESEND_GENERIC_MESSAGE, 'sin enumerar usuarios');
    const { token: nuevo } = lastVerifyToken();
    const okNuevo = await api.post(VERIFY).send({ token: nuevo });
    assertOk(okNuevo, 200);

    delta.token = await login(api, 'admin-delta@test.local', 'Delta1234!');
  });

  it('5.6 — dos empresas: los datos de una no existen para la otra', async () => {
    // Gamma crea un cliente.
    const cust = await api
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${gamma.token}`)
      .send({ name: 'Cliente Gamma SA', email: 'cliente@gamma.test', phone: '5512345678' });
    assertOk(cust, 201);
    const custId = String(cust.body.data._id);

    // Delta no lo ve en su listado…
    const list = await api.get('/api/v1/customers').set('Authorization', `Bearer ${delta.token}`);
    assertOk(list, 200);
    assert.ok(!JSON.stringify(list.body).includes(custId), 'el cliente de Gamma no aparece en Delta');

    // …ni puede abrirlo (aislamiento 404).
    const cross = await api.get(`/api/v1/customers/${custId}`).set('Authorization', `Bearer ${delta.token}`);
    assertError(cross, 404, 'NOT_FOUND');

    // Gamma sí lo ve: el flujo propio no se toca.
    const own = await api.get(`/api/v1/customers/${custId}`).set('Authorization', `Bearer ${gamma.token}`);
    assertOk(own, 200);
  });

  it('5.7 — cada administrador sólo administra SU empresa (RBAC + aislamiento)', async () => {
    // No puede editar la empresa ajena (404 por aislamiento)…
    const crossPatch = await api
      .patch(`/api/v1/companies/${gamma.companyId}`)
      .set('Authorization', `Bearer ${delta.token}`)
      .send({ phone: '5599999999' });
    assertError(crossPatch, 404, 'NOT_FOUND');

    // …ni tocar roles de otra empresa.
    const crossRole = await api
      .delete(`/api/v1/roles/${fx.roles.Ventas._id}`)
      .set('Authorization', `Bearer ${delta.token}`);
    assertError(crossRole, 404, 'NOT_FOUND');

    // La lista de usuarios sólo contiene los de SU empresa.
    const users = await api.get('/api/v1/users').set('Authorization', `Bearer ${delta.token}`);
    assertOk(users, 200);
    const raw = JSON.stringify(users.body);
    assert.ok(raw.includes('admin-delta@test.local'), 'su propia cuenta');
    assert.ok(!raw.includes('admin-gamma@test.local'), 'nunca el admin de otra empresa');
    assert.ok(!raw.includes(fx.admin.email), 'nunca el admin de Alfa');

    // Con permiso Administrador completo sí gestiona la suya.
    const ownPatch = await api
      .patch(`/api/v1/companies/${delta.companyId}`)
      .set('Authorization', `Bearer ${delta.token}`)
      .send({ phone: '5588888888' });
    assertOk(ownPatch, 200);
    const updated = await Company.findById(delta.companyId).lean();
    assert.equal(updated.phone, '5588888888');
  });

  it('5.8 — el registro por invitación sigue intacto junto al público', async () => {
    // El admin de Gamma invita a una empleada a SU empresa (flujo existente).
    const inv = await api
      .post('/api/v1/users/invitations')
      .set('Authorization', `Bearer ${gamma.token}`)
      .send({
        email: 'empleada-gamma@test.local',
        firstName: 'Empleada',
        lastName: 'Gamma',
        roleId: gamma.adminRoleId,
      });
    assertOk(inv, 201);

    // El token llega sólo por el correo simulado.
    const outbox = drainTestOutbox();
    const msg = outbox[outbox.length - 1];
    assert.ok(msg, 'el correo de invitación debía quedar en el buzón');
    const m = msg.text.match(/token=([A-Za-z0-9_-]+)/);
    assert.ok(m, 'el correo de invitación incluye el enlace con token');

    // Registrarse con la invitación entra a la empresa EXISTENTE (no crea otra).
    const reg = await api.post('/api/v1/auth/register').send({
      inviteToken: m[1],
      firstName: 'Empleada',
      lastName: 'Gamma',
      email: 'empleada-gamma@test.local',
      password: 'Empleada123!',
      passwordConfirm: 'Empleada123!',
    });
    assertOk(reg, 201);

    const empleada = await User.findOne({ email: 'empleada-gamma@test.local' }).lean();
    assert.equal(String(empleada.companyId), gamma.companyId, 'entra en la empresa del invitador');
    assert.notEqual(String(empleada.companyId), delta.companyId);
    assert.equal(empleada.verificationRequired, true, 'la invitación conserva la verificación');
    assert.equal(empleada.roleId.toString(), gamma.adminRoleId, 'rol elegido por QUIEN INVITA');
  });
});
