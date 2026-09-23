'use strict';

/**
 * tests/sales.test.js — SUITE DE VENTAS (FLUJO C)
 *
 * Qué verifica:
 *  - POST /sales → DRAFT con totales calculados en servidor (IVA 21%);
 *  - confirm con stock suficiente → CONFIRMED + balance descontado +
 *    movimiento EXIT + auditoría CONFIRM_SALE;
 *  - confirm con cantidad > stock → 409 CONFLICT, la venta SIGUE en DRAFT y
 *    el balance NO cambia (atomicidad de la transacción);
 *  - cancelar una venta confirmada → CANCELLED + movimiento RETURN + balance
 *    restaurado + el documento guarda cancelReason/cancelledBy/cancelledAt +
 *    auditoría CANCEL_SALE;
 *  - complete de una CONFIRMED → COMPLETED;
 *  - venta con un producto de OTRA empresa → 404 NOT_FOUND (aislamiento).
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');

const app = require('../src/app');
const { setup, teardown, login, assertOk, assertError } = require('./helpers');

const Company = require('../src/modules/companies/model');
const Category = require('../src/modules/categories/model');
const Product = require('../src/modules/products/model');

const api = request(app);

let fx;
let token;
let customerId;
let productId;
let saleConfirmed; // la que se confirma y luego se cancela
let saleTooMuch;   // cantidad mayor que el stock
let saleCompleted; // se confirma y se completa

const STOCK = 10;
const SELL_QTY = 5;

/** GET /inventory?productId=… → quantity. */
async function getBalanceQuantity() {
  const res = await api
    .get(`/api/v1/inventory?productId=${productId}`)
    .set('Authorization', `Bearer ${token}`);
  assertOk(res, 200);
  assert.equal(res.body.data.items.length, 1);
  return res.body.data.items[0].quantity;
}

/** GET /inventory/movements?type=… → data. */
async function movementsByType(type) {
  const res = await api
    .get(`/api/v1/inventory/movements?type=${type}`)
    .set('Authorization', `Bearer ${token}`);
  assertOk(res, 200);
  return res.body.data;
}

/** GET /audit?action=… → pagination.total. */
async function auditTotal(action) {
  const res = await api
    .get(`/api/v1/audit?action=${action}`)
    .set('Authorization', `Bearer ${token}`);
  assertOk(res, 200);
  return res.body.data.pagination.total;
}

describe('VENTAS — confirmación, reversa y aislamiento', () => {
  before(async () => {
    fx = await setup();
    token = await login(api, fx.admin.email, fx.admin.password);

    // Fixtures: categoría + producto + cliente + stock inicial de 10.
    const cat = await api
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ventas' });
    assertOk(cat, 201);

    const prod = await api
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sku: 'SKU-VENTA-001',
        name: 'Producto Vendido',
        categoryId: String(cat.body.data._id),
        purchasePrice: 5,
        salePrice: 20,
      });
    assertOk(prod, 201);
    productId = String(prod.body.data._id);

    const cust = await api
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cliente Prueba', email: 'cliente@prueba.test' });
    assertOk(cust, 201);
    customerId = String(cust.body.data._id);

    const entry = await api
      .post('/api/v1/inventory/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, warehouseId: fx.warehouseId, type: 'ENTRY', quantity: STOCK });
    assertOk(entry, 201);
    assert.equal(await getBalanceQuantity(), STOCK);
  });
  after(teardown);

  it('POST /sales → DRAFT con totales calculados (IVA 21%)', async () => {
    const res = await api
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        warehouseId: fx.warehouseId,
        items: [{ productId, quantity: SELL_QTY, unitPrice: 20 }],
        notes: 'Venta de prueba',
      });

    assertOk(res, 201);
    assert.equal(res.body.data.status, 'DRAFT');
    assert.equal(res.body.data.subtotal, 100); // 5 * 20
    assert.equal(res.body.data.tax, 21);       // 100 * 0.21
    assert.equal(res.body.data.total, 121);
    assert.equal(res.body.data.items[0].subtotal, 100);
    assert.equal(res.body.data.companyId, fx.companyId);
    saleConfirmed = String(res.body.data._id);
  });

  it('confirm con stock suficiente → CONFIRMED + balance baja + EXIT + audit CONFIRM_SALE', async () => {
    const res = await api
      .post(`/api/v1/sales/${saleConfirmed}/confirm`)
      .set('Authorization', `Bearer ${token}`);

    assertOk(res, 200);
    assert.equal(res.body.data.status, 'CONFIRMED');
    assert.ok(res.body.data.confirmedAt);

    // Stock descontado (10 → 5).
    assert.equal(await getBalanceQuantity(), STOCK - SELL_QTY);

    // Movimiento EXIT con trazabilidad.
    const exits = await movementsByType('EXIT');
    assert.equal(exits.pagination.total, 1);
    assert.equal(exits.items[0].type, 'EXIT');
    assert.equal(exits.items[0].previousQuantity, STOCK);
    assert.equal(exits.items[0].newQuantity, STOCK - SELL_QTY);
    assert.equal(exits.items[0].referenceType, 'SALE');
    assert.equal(exits.items[0].referenceId, saleConfirmed);

    assert.ok((await auditTotal('CONFIRM_SALE')) >= 1, 'faltaba auditoría CONFIRM_SALE');
  });

  it('confirm con cantidad > stock → 409, la venta SIGUE en DRAFT y el balance NO cambia', async () => {
    // Borrador con 100 unidades (sólo hay 5 disponibles).
    const draft = await api
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        warehouseId: fx.warehouseId,
        items: [{ productId, quantity: 100, unitPrice: 20 }],
      });
    assertOk(draft, 201);
    saleTooMuch = String(draft.body.data._id);

    const confirm = await api
      .post(`/api/v1/sales/${saleTooMuch}/confirm`)
      .set('Authorization', `Bearer ${token}`);
    assertError(confirm, 409, 'CONFLICT');
    assert.match(confirm.body.error.message, /Stock insuficiente/i);

    // Atomicidad: ni la venta ni el stock cambian.
    const check = await api
      .get(`/api/v1/sales/${saleTooMuch}`)
      .set('Authorization', `Bearer ${token}`);
    assertOk(check, 200);
    assert.equal(check.body.data.status, 'DRAFT');
    assert.equal(await getBalanceQuantity(), STOCK - SELL_QTY);

    // Tampoco se registró ningún movimiento nuevo de salida.
    const exits = await movementsByType('EXIT');
    assert.equal(exits.pagination.total, 1);
  });

  it('cancelar venta CONFIRMED → CANCELLED + RETURN + balance restaurado + campos en el doc', async () => {
    const res = await api
      .post(`/api/v1/sales/${saleConfirmed}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cancelReason: 'Cliente se arrepintió' });

    assertOk(res, 200);
    assert.equal(res.body.data.status, 'CANCELLED');

    // El documento conserva la trazabilidad de la cancelación.
    const check = await api
      .get(`/api/v1/sales/${saleConfirmed}`)
      .set('Authorization', `Bearer ${token}`);
    assertOk(check, 200);
    assert.equal(check.body.data.status, 'CANCELLED');
    assert.equal(check.body.data.cancelReason, 'Cliente se arrepintió');
    assert.ok(check.body.data.cancelledBy, 'faltaba cancelledBy');
    assert.equal(String(check.body.data.cancelledBy._id || check.body.data.cancelledBy), fx.admin.id);
    assert.ok(check.body.data.cancelledAt, 'faltaba cancelledAt');

    // Reversa de inventario con RETURN (5 → 10).
    const returns = await movementsByType('RETURN');
    assert.equal(returns.pagination.total, 1);
    assert.equal(returns.items[0].type, 'RETURN');
    assert.equal(returns.items[0].previousQuantity, STOCK - SELL_QTY);
    assert.equal(returns.items[0].newQuantity, STOCK);
    assert.equal(await getBalanceQuantity(), STOCK);

    assert.ok((await auditTotal('CANCEL_SALE')) >= 1, 'faltaba auditoría CANCEL_SALE');
  });

  it('complete de una venta CONFIRMED → COMPLETED', async () => {
    const draft = await api
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        warehouseId: fx.warehouseId,
        items: [{ productId, quantity: 2, unitPrice: 15 }],
      });
    assertOk(draft, 201);
    saleCompleted = String(draft.body.data._id);

    const confirm = await api
      .post(`/api/v1/sales/${saleCompleted}/confirm`)
      .set('Authorization', `Bearer ${token}`);
    assertOk(confirm, 200);
    assert.equal(confirm.body.data.status, 'CONFIRMED');

    const complete = await api
      .post(`/api/v1/sales/${saleCompleted}/complete`)
      .set('Authorization', `Bearer ${token}`);
    assertOk(complete, 200);
    assert.equal(complete.body.data.status, 'COMPLETED');
    assert.ok(complete.body.data.completedAt);
  });

  it('venta con un producto de OTRA empresa → 404 NOT_FOUND', async () => {
    // Producto real perteneciente a otra empresa (creado directamente en BD).
    const otherCompany = await Company.create({
      name: 'Empresa Gamma',
      status: 'active',
    });
    const otherCategory = await Category.create({
      name: 'Ajena',
      companyId: otherCompany._id,
    });
    const otherProduct = await Product.create({
      sku: 'SKU-GAMMA-001',
      name: 'Producto Ajeno',
      categoryId: otherCategory._id,
      purchasePrice: 1,
      salePrice: 2,
      companyId: otherCompany._id,
    });

    const res = await api
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        warehouseId: fx.warehouseId,
        items: [{ productId: String(otherProduct._id), quantity: 1, unitPrice: 10 }],
      });

    assertError(res, 404, 'NOT_FOUND');
    assert.match(res.body.error.message, /Productos no encontrados/i);
  });
});
