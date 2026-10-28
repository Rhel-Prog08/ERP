'use strict';

process.env.MAIL_PROVIDER = 'test';
process.env.REGISTRATION_ENABLED = 'true';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const app = require('../src/app');
const { setup, teardown, login, assertOk, assertError } = require('./helpers');
const Company = require('../src/modules/companies/model');
const Role = require('../src/modules/roles/model');
const User = require('../src/modules/users/model');
const { drainTestOutbox } = require('../src/utils/mailer');

const api = request(app);

describe('SEGURIDAD — asignación de roles y roles inactivos', () => {
  let fx;
  let adminToken;
  let limitedToken;
  let limitedRole;
  let assignableRole;
  let elevatedRole;
  let inactiveRole;
  let targetUserId;
  let betaRole;

  before(async () => {
    fx = await setup();
    drainTestOutbox();
    adminToken = await login(api, fx.admin.email, fx.admin.password);

    limitedRole = await Role.create({
      name: 'Gestor limitado de usuarios',
      companyId: fx.companyId,
      permissions: ['users.read', 'users.create', 'users.update', 'products.read'],
      status: 'active',
    });
    assignableRole = await Role.create({
      name: 'Empleado limitado',
      companyId: fx.companyId,
      permissions: ['users.read', 'products.read'],
      status: 'active',
    });
    elevatedRole = await Role.create({
      name: 'Rol con privilegios no delegables',
      companyId: fx.companyId,
      permissions: ['users.read', 'products.create'],
      status: 'active',
    });
    inactiveRole = await Role.create({
      name: 'Rol inactivo',
      companyId: fx.companyId,
      permissions: ['users.read'],
      status: 'inactive',
    });

    await User.create({
      firstName: 'Gestor',
      lastName: 'Limitado',
      email: 'gestor-limitado@test.local',
      password: 'Gestor12345!',
      roleId: limitedRole._id,
      companyId: fx.companyId,
    });
    limitedToken = await login(api, 'gestor-limitado@test.local', 'Gestor12345!');

    const target = await api
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Usuario',
        lastName: 'Objetivo',
        email: 'objetivo@test.local',
        password: 'Objetivo12345!',
        roleId: String(assignableRole._id),
      });
    assertOk(target, 201);
    targetUserId = String(target.body.data._id);

    const betaCompany = await Company.create({
      name: 'Empresa Beta',
      taxId: 'B-22222222',
      email: 'beta@test.local',
      status: 'active',
    });
    betaRole = await Role.create({
      name: 'Administrador',
      companyId: betaCompany._id,
      permissions: fx.roles.Administrador.permissions,
      isSystem: true,
      status: 'active',
    });
  });

  after(teardown);

  it('permite al Administrador propietario delegar roles y conservar el alta cross-company', async () => {
    const created = await api
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Administrador',
        lastName: 'Delegado',
        email: 'admin-delegado@test.local',
        password: 'Delegado12345!',
        roleId: String(fx.roles.Administrador._id),
      });
    assertOk(created, 201);

    const crossCompany = await api
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Administrador',
        lastName: 'Beta',
        email: 'admin-beta-security@test.local',
        password: 'BetaAdmin12345!',
        roleId: String(betaRole._id),
        companyId: String(betaRole.companyId),
      });
    assertOk(crossCompany, 201);
    assert.equal(crossCompany.body.data.companyId, String(betaRole.companyId));
  });

  it('bloquea escalada de privilegios por creación, edición e invitación', async () => {
    const createAdmin = await api
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({
        firstName: 'No',
        lastName: 'Admin',
        email: 'no-admin@test.local',
        password: 'NoAdmin12345!',
        roleId: String(fx.roles.Administrador._id),
      });
    assertError(createAdmin, 403, 'AUTHORIZATION_ERROR');

    const createElevated = await api
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({
        firstName: 'No',
        lastName: 'Elevado',
        email: 'no-elevado@test.local',
        password: 'NoElevado12345!',
        roleId: String(elevatedRole._id),
      });
    assertError(createElevated, 403, 'AUTHORIZATION_ERROR');

    const editAdmin = await api
      .patch(`/api/v1/users/${targetUserId}`)
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({ roleId: String(fx.roles.Administrador._id) });
    assertError(editAdmin, 403, 'AUTHORIZATION_ERROR');

    const editElevated = await api
      .patch(`/api/v1/users/${targetUserId}`)
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({ roleId: String(elevatedRole._id) });
    assertError(editElevated, 403, 'AUTHORIZATION_ERROR');

    const inviteAdmin = await api
      .post('/api/v1/users/invitations')
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({
        email: 'invitado-admin@test.local',
        firstName: 'Invitado',
        lastName: 'Admin',
        roleId: String(fx.roles.Administrador._id),
      });
    assertError(inviteAdmin, 403, 'AUTHORIZATION_ERROR');

    const inviteElevated = await api
      .post('/api/v1/users/invitations')
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({
        email: 'invitado-elevado@test.local',
        firstName: 'Invitado',
        lastName: 'Elevado',
        roleId: String(elevatedRole._id),
      });
    assertError(inviteElevated, 403, 'AUTHORIZATION_ERROR');

    const createdRegular = await api
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({
        firstName: 'Usuario',
        lastName: 'Autorizado',
        email: 'usuario-autorizado@test.local',
        password: 'Autorizado12345!',
        roleId: String(assignableRole._id),
      });
    assertOk(createdRegular, 201);

    const inviteRegular = await api
      .post('/api/v1/users/invitations')
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({
        email: 'invitado-autorizado@test.local',
        firstName: 'Invitado',
        lastName: 'Autorizado',
        roleId: String(assignableRole._id),
      });
    assertOk(inviteRegular, 201);
    drainTestOutbox();
  });

  it('rechaza asignaciones e invitaciones a roles inactivos y roles de otra empresa', async () => {
    const createInactive = await api
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Rol',
        lastName: 'Inactivo',
        email: 'rol-inactivo@test.local',
        password: 'RolInactivo12345!',
        roleId: String(inactiveRole._id),
      });
    assertError(createInactive, 409, 'CONFLICT');

    const editInactive = await api
      .patch(`/api/v1/users/${targetUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleId: String(inactiveRole._id) });
    assertError(editInactive, 409, 'CONFLICT');

    const inviteInactive = await api
      .post('/api/v1/users/invitations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'invitado-inactivo@test.local',
        firstName: 'Invitado',
        lastName: 'Inactivo',
        roleId: String(inactiveRole._id),
      });
    assertError(inviteInactive, 409, 'CONFLICT');

    const assignForeignRole = await api
      .patch(`/api/v1/users/${targetUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleId: String(betaRole._id) });
    assertError(assignForeignRole, 400, 'VALIDATION_ERROR');

    const inviteForeignRole = await api
      .post('/api/v1/users/invitations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'invitado-empresa-ajena@test.local',
        firstName: 'Invitado',
        lastName: 'Ajeno',
        roleId: String(betaRole._id),
      });
    assertError(inviteForeignRole, 400, 'VALIDATION_ERROR');

    const mismatchedUser = await User.create({
      firstName: 'Usuario',
      lastName: 'Desvinculado',
      email: 'rol-empresa-ajena@test.local',
      password: 'Desvinculado12345!',
      roleId: betaRole._id,
      companyId: fx.companyId,
    });
    const mismatchedToken = jwt.sign(
      {
        sub: String(mismatchedUser._id),
        roleVersion: betaRole.authorizationVersion,
      },
      process.env.JWT_SECRET
    );
    const mismatchedAccess = await api
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${mismatchedToken}`);
    assertError(mismatchedAccess, 403, 'AUTHORIZATION_ERROR');
  });

  it('bloquea una invitación pendiente si su rol se desactiva antes del registro', async () => {
    const lateRole = await Role.create({
      name: 'Rol desactivado tras invitar',
      companyId: fx.companyId,
      permissions: ['products.read'],
      status: 'active',
    });
    const invite = await api
      .post('/api/v1/users/invitations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'invitacion-tardia@test.local',
        firstName: 'Invitación',
        lastName: 'Tardía',
        roleId: String(lateRole._id),
      });
    assertOk(invite, 201);
    const mail = drainTestOutbox().pop();
    const tokenMatch = mail.text.match(/token=([A-Za-z0-9_-]+)/);
    assert.ok(tokenMatch, 'el correo de invitación debe contener el token');

    await Role.updateOne({ _id: lateRole._id }, { $set: { status: 'inactive' } });
    const register = await api.post('/api/v1/auth/register').send({
      inviteToken: tokenMatch[1],
      firstName: 'Invitación',
      lastName: 'Tardía',
      email: 'invitacion-tardia@test.local',
      password: 'Tardia12345!',
      passwordConfirm: 'Tardia12345!',
    });
    assertError(register, 400, 'VALIDATION_ERROR');
    assert.equal(await User.exists({ email: 'invitacion-tardia@test.local' }), null);
  });

  it('revoca definitivamente access y refresh tokens al desactivar o reactivar un rol', async () => {
    const ownRole = await api
      .patch(`/api/v1/roles/${fx.roles.Administrador._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'inactive' });
    assertError(ownRole, 409, 'CONFLICT');

    const memberRole = await Role.create({
      name: 'Rol desactivable',
      companyId: fx.companyId,
      permissions: ['products.read'],
      status: 'active',
    });
    const member = await api
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Miembro',
        lastName: 'Desactivable',
        email: 'miembro-desactivable@test.local',
        password: 'Desactivable12345!',
        roleId: String(memberRole._id),
      });
    assertOk(member, 201);

    const memberSession = await api
      .post('/api/v1/auth/login')
      .send({ email: 'miembro-desactivable@test.local', password: 'Desactivable12345!' });
    assertOk(memberSession, 200);
    const { accessToken, refreshToken } = memberSession.body.data;
    const initialRoleVersion = memberRole.authorizationVersion;

    const disabled = await api
      .patch(`/api/v1/roles/${memberRole._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'inactive' });
    assertOk(disabled, 200);

    const protectedRequest = await api
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    assertError(protectedRequest, 401, 'AUTHENTICATION_ERROR');
    const disabledRole = await Role.findById(memberRole._id).lean();
    assert.equal(disabledRole.authorizationVersion, initialRoleVersion + 1);

    const refresh = await api.post('/api/v1/auth/refresh').send({ refreshToken });
    assertError(refresh, 401, 'AUTHENTICATION_ERROR');
    const revokedSessions = await User.findById(member.body.data._id).select('+refreshTokens').lean();
    assert.equal(revokedSessions.refreshTokens.length, 0);

    const loginInactiveRole = await api
      .post('/api/v1/auth/login')
      .send({ email: 'miembro-desactivable@test.local', password: 'Desactivable12345!' });
    assertError(loginInactiveRole, 401, 'AUTHENTICATION_ERROR');

    const reactivated = await api
      .patch(`/api/v1/roles/${memberRole._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' });
    assertOk(reactivated, 200);
    const reactivatedRole = await Role.findById(memberRole._id).lean();
    assert.equal(reactivatedRole.authorizationVersion, initialRoleVersion + 2);

    const staleAccessAfterReactivation = await api
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    assertError(staleAccessAfterReactivation, 401, 'AUTHENTICATION_ERROR');

    const legacyAccessToken = jwt.sign(
      { sub: String(member.body.data._id) },
      process.env.JWT_SECRET
    );
    const legacyAccess = await api
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${legacyAccessToken}`);
    assertError(legacyAccess, 401, 'AUTHENTICATION_ERROR');

    const beforeFreshLogin = await User.findById(member.body.data._id).select('+refreshTokens').lean();
    assert.equal(beforeFreshLogin.refreshTokens.length, 0);

    const freshSession = await api
      .post('/api/v1/auth/login')
      .send({ email: 'miembro-desactivable@test.local', password: 'Desactivable12345!' });
    assertOk(freshSession, 200);
    const freshAccess = await api
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${freshSession.body.data.accessToken}`);
    assertOk(freshAccess, 200);

    const storedMember = await User.findById(member.body.data._id).select('+refreshTokens').lean();
    assert.equal(storedMember.refreshTokens.length, 1);
  });
});
