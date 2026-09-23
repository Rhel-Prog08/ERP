'use strict';

/**
 * tests/auth.test.js — SUITE DE AUTENTICACIÓN
 *
 * Qué verifica:
 *  - login válido → 200 con accessToken/refreshToken/expiresIn y
 *    user.role.permissions (array) en el sobre {success:true};
 *  - contraseña incorrecta → 401 AUTHENTICATION_ERROR;
 *  - access token ausente, corrupto o CADUCADO (jwt firmado con
 *    expiresIn:'-10s') → 401 AUTHENTICATION_ERROR;
 *  - bloqueo de cuenta: 5 logins fallidos seguidos y el 6º con la contraseña
 *    CORRECTA → 401 con mensaje de bloqueo (MAX_LOGIN_ATTEMPTS);
 *  - GET /auth/me sin token → 401;
 *  - logout con refresh token → 200 y REUSE posterior de ese refresh → 401
 *    (rotación de refresh tokens);
 *  - POST /auth/refresh con token inventado → 401.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const app = require('../src/app');
const { setup, teardown, login, loginRaw, assertOk, assertError } = require('./helpers');

const api = request(app);

let fx; // fixtures de setup() (Empresa Alfa + usuarios)

describe('AUTH — login, tokens, rotación y bloqueo', () => {
  before(async () => {
    fx = await setup();
  });
  after(teardown);

  it('login válido → 200 con tokens, expiresIn y user.role.permissions', async () => {
    const res = await api
      .post('/api/v1/auth/login')
      .send({ email: fx.admin.email, password: fx.admin.password });

    assertOk(res, 200);
    const { user, accessToken, refreshToken, expiresIn } = res.body.data;
    assert.equal(typeof accessToken, 'string');
    assert.ok(accessToken.length > 20);
    assert.equal(typeof refreshToken, 'string');
    assert.ok(refreshToken.length >= 16);
    assert.equal(typeof expiresIn, 'number');
    assert.ok(expiresIn > 0);
    assert.equal(user.email, fx.admin.email);
    assert.equal(user.company.id, fx.companyId);
    assert.equal(user.role.name, 'Administrador');
    assert.ok(Array.isArray(user.role.permissions));
    assert.ok(user.role.permissions.includes('products.create'));
  });

  it('login con contraseña incorrecta → 401 AUTHENTICATION_ERROR', async () => {
    const res = await api
      .post('/api/v1/auth/login')
      .send({ email: fx.admin.email, password: 'NoEsLaClave999' });

    assertError(res, 401, 'AUTHENTICATION_ERROR');
    assert.equal(res.body.error.message, 'Credenciales inválidas');
  });

  it('GET /auth/me sin token → 401 AUTHENTICATION_ERROR', async () => {
    const res = await api.get('/api/v1/auth/me');
    assertError(res, 401, 'AUTHENTICATION_ERROR');
  });

  it("access token corrupto ('Bearer basura') → 401 AUTHENTICATION_ERROR", async () => {
    const res = await api.get('/api/v1/auth/me').set('Authorization', 'Bearer basura');
    assertError(res, 401, 'AUTHENTICATION_ERROR');
  });

  it('access token CADUCADO (expiración en el pasado) → 401 AUTHENTICATION_ERROR', async () => {
    const expired = jwt.sign(
      {
        sub: fx.admin.id,
        companyId: fx.companyId,
        roleId: String(fx.roles.Administrador._id),
      },
      process.env.JWT_SECRET,
      { expiresIn: '-10s' }
    );

    const res = await api.get('/api/v1/auth/me').set('Authorization', `Bearer ${expired}`);
    assertError(res, 401, 'AUTHENTICATION_ERROR');
    assert.match(res.body.error.message, /expirada/i);
  });

  it('logout con refresh token → 200 y reuse posterior → 401 (rotación)', async () => {
    const data = await loginRaw(api, fx.admin.email, fx.admin.password);
    assert.ok(data.refreshToken);

    const out = await api.post('/api/v1/auth/logout').send({ refreshToken: data.refreshToken });
    assertOk(out, 200);
    assert.equal(out.body.data.message, 'Sesión cerrada');

    // Ese refresh ya fue eliminado: reutilizarlo debe fallar.
    const reuse = await api
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: data.refreshToken });
    assertError(reuse, 401, 'AUTHENTICATION_ERROR');
    assert.match(reuse.body.error.message, /refresh token/i);
  });

  it('POST /auth/refresh con refresh token inventado → 401 AUTHENTICATION_ERROR', async () => {
    const res = await api
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'refresh-inventado-0123456789abcdef' });
    assertError(res, 401, 'AUTHENTICATION_ERROR');
  });

  it('5 logins fallidos bloquean la cuenta: el 6º con la contraseña CORRECTA → 401 (bloqueo)', async () => {
    // Se usa el usuario "Ventas" para no inmovilizar al administrador.
    for (let i = 1; i <= 5; i += 1) {
      const fail = await api
        .post('/api/v1/auth/login')
        .send({ email: fx.ventas.email, password: `ClaveMala${i}!xyz` });
      assertError(fail, 401, 'AUTHENTICATION_ERROR');
      assert.equal(fail.body.error.message, 'Credenciales inválidas');
    }

    const locked = await api
      .post('/api/v1/auth/login')
      .send({ email: fx.ventas.email, password: fx.ventas.password });

    assertError(locked, 401, 'AUTHENTICATION_ERROR');
    assert.match(
      locked.body.error.message,
      /bloqueada por intentos fallidos/i,
      `esperaba mensaje de bloqueo, llegó: ${locked.body.error.message}`
    );
  });
});
