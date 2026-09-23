'use strict';

/**
 * tests/rbac.test.js — SUITE DE AUTORIZACIÓN RBAC
 *
 * Qué verifica:
 *  - sin token → GET /users → 401 AUTHENTICATION_ERROR;
 *  - usuario con rol "Consulta" (sin products.create) → POST /products →
 *    403 AUTHORIZATION_ERROR y el producto NO se crea;
 *  - "Consulta" → GET /products → 200 con {items, pagination} (sí tiene
 *    products.read);
 *  - "Consulta" → GET /audit → 403 (el rol Consulta NO tiene audit.read);
 *  - administrador → GET /audit → 200 con {items, pagination}.
 */

const { describe, it, before, after } = require('node:test');
const request = require('supertest');

const app = require('../src/app');
const { setup, teardown, login, assertOk, assertError } = require('./helpers');

const api = request(app);

let fx;
let tokenAdmin;
let tokenConsulta;

describe('RBAC — permisos por rol y envelope de errores', () => {
  before(async () => {
    fx = await setup();
    tokenAdmin = await login(api, fx.admin.email, fx.admin.password);
    tokenConsulta = await login(api, fx.consulta.email, fx.consulta.password);
  });
  after(teardown);

  it('sin token → GET /users → 401 AUTHENTICATION_ERROR', async () => {
    const res = await api.get('/api/v1/users');
    assertError(res, 401, 'AUTHENTICATION_ERROR');
  });

  it('rol Consulta → POST /products → 403 AUTHORIZATION_ERROR (y no se crea)', async () => {
    const res = await api
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${tokenConsulta}`)
      .send({ sku: 'SKU-NOCREADO', name: 'No Debe Crearse', purchasePrice: 1, salePrice: 2 });

    assertError(res, 403, 'AUTHORIZATION_ERROR');
    assert.match(res.body.error.message, /products\.create/);

    // Ni siquiera con el admin hay productos: la creación fue rechazada.
    const list = await api.get('/api/v1/products').set('Authorization', `Bearer ${tokenAdmin}`);
    assertOk(list, 200);
    assert.equal(list.body.data.pagination.total, 0);
  });

  it('rol Consulta → GET /products → 200 con {items, pagination}', async () => {
    const res = await api.get('/api/v1/products').set('Authorization', `Bearer ${tokenConsulta}`);

    assertOk(res, 200);
    assert.ok(Array.isArray(res.body.data.items));
    assert.equal(typeof res.body.data.pagination.total, 'number');
  });

  it('rol Consulta → GET /audit → 403 AUTHORIZATION_ERROR (sin audit.read)', async () => {
    const res = await api.get('/api/v1/audit').set('Authorization', `Bearer ${tokenConsulta}`);
    assertError(res, 403, 'AUTHORIZATION_ERROR');
    assert.match(res.body.error.message, /audit\.read/);
  });

  it('admin → GET /audit → 200 con {items, pagination}', async () => {
    const res = await api.get('/api/v1/audit').set('Authorization', `Bearer ${tokenAdmin}`);

    assertOk(res, 200);
    assert.ok(Array.isArray(res.body.data.items));
    assert.equal(typeof res.body.data.pagination.total, 'number');
  });
});
