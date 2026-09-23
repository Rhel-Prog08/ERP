'use strict';

/**
 * tests/products.test.js — SUITE DE PRODUCTOS (CRUD por empresa)
 *
 * Qué verifica:
 *  - POST /categories → 201 con companyId del token;
 *  - POST /products → 201 con el SKU y el companyId correctos;
 *  - SKU duplicado en la MISMA empresa → 409 CONFLICT (índice único);
 *  - producto sin categoryId → 400 VALIDATION_ERROR;
 *  - producto con categoryId inexistente → 404 NOT_FOUND;
 *  - PATCH del precio → 200 y auditLogs contiene UPDATE_PRODUCT;
 *  - DELETE → 200 y el producto queda con status inactive (borrado lógico).
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');

const app = require('../src/app');
const { setup, teardown, login, assertOk, assertError } = require('./helpers');

const api = request(app);

let fx;
let token;
let categoryId;
let productId;

const SKU = 'SKU-ALFA-001';

describe('PRODUCTOS — CRUD, SKU único y auditoría', () => {
  before(async () => {
    fx = await setup();
    token = await login(api, fx.admin.email, fx.admin.password);
  });
  after(teardown);

  it('POST /categories → 201 con companyId de la empresa del token', async () => {
    const res = await api
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'General', description: 'Categoría general' });

    assertOk(res, 201);
    assert.equal(res.body.data.name, 'General');
    assert.equal(res.body.data.companyId, fx.companyId);
    categoryId = String(res.body.data._id);
    assert.ok(mongoose.isValidObjectId(categoryId));
  });

  it('POST /products → 201 con SKU y companyId correctos', async () => {
    const res = await api
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sku: SKU,
        name: 'Producto Alfa',
        description: 'Producto de prueba',
        categoryId,
        purchasePrice: 10,
        salePrice: 15,
        stockMin: 2,
        unit: 'unidad',
      });

    assertOk(res, 201);
    assert.equal(res.body.data.sku, SKU);
    assert.equal(res.body.data.name, 'Producto Alfa');
    assert.equal(res.body.data.companyId, fx.companyId);
    assert.equal(res.body.data.status, 'active');
    productId = String(res.body.data._id);
  });

  it('SKU duplicado en la MISMA empresa → 409 CONFLICT', async () => {
    const res = await api
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sku: SKU, // mismo SKU, distinto nombre
        name: 'Otro Producto',
        categoryId,
        purchasePrice: 5,
        salePrice: 9,
      });

    assertError(res, 409, 'CONFLICT');
    assert.match(res.body.error.message, /ya existe/i);
  });

  it('POST /products sin categoryId → 400 VALIDATION_ERROR', async () => {
    const res = await api
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ sku: 'SKU-SIN-CATEGORIA', name: 'Sin Categoría', purchasePrice: 1, salePrice: 2 });

    assertError(res, 400, 'VALIDATION_ERROR');
    assert.ok(
      res.body.error.details.some((d) => d.field === 'categoryId'),
      `esperaba detalle del campo categoryId: ${JSON.stringify(res.body.error.details)}`
    );
  });

  it('POST /products con categoryId inexistente → 404 NOT_FOUND', async () => {
    const res = await api
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sku: 'SKU-CAT-MUERTA',
        name: 'Categoría Inexistente',
        categoryId: new mongoose.Types.ObjectId().toString(),
        purchasePrice: 1,
        salePrice: 2,
      });

    assertError(res, 404, 'NOT_FOUND');
  });

  it('PATCH /products/:id cambia el precio → 200 y auditoría UPDATE_PRODUCT', async () => {
    const patch = await api
      .patch(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ salePrice: 19.99 });

    assertOk(patch, 200);
    assert.equal(patch.body.data.salePrice, 19.99);

    const audit = await api
      .get('/api/v1/audit?action=UPDATE_PRODUCT')
      .set('Authorization', `Bearer ${token}`);
    assertOk(audit, 200);
    assert.ok(
      audit.body.data.pagination.total >= 1,
      `esperaba al menos una entrada UPDATE_PRODUCT: ${JSON.stringify(audit.body.data.items)}`
    );
    assert.equal(audit.body.data.items[0].action, 'UPDATE_PRODUCT');
    assert.equal(audit.body.data.items[0].newValue.salePrice, 19.99);
  });

  it('DELETE /products/:id → 200 con status inactive (borrado lógico)', async () => {
    const res = await api
      .delete(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${token}`);

    assertOk(res, 200);
    assert.equal(res.body.data.status, 'inactive');

    // Verificación indirecta en el listado: sigue ahí pero inactivo.
    const list = await api
      .get('/api/v1/products?status=inactive')
      .set('Authorization', `Bearer ${token}`);
    assertOk(list, 200);
    assert.equal(list.body.data.pagination.total, 1);
    assert.equal(list.body.data.items[0].status, 'inactive');
  });
});
