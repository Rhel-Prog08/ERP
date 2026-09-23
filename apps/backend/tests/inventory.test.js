'use strict';

/**
 * tests/inventory.test.js — SUITE DE INVENTARIO
 *
 * Qué verifica:
 *  - ENTRY de 10 vía POST /inventory/movements → balance.quantity=10,
 *    movimiento con previousQuantity=0 y newQuantity=10, auditoría STOCK_ENTRY;
 *  - EXIT de 15 con balance 10 → 409 CONFLICT ('Stock insuficiente') y el
 *    balance SIGUE en 10 (sin descuento parcial y sin movimiento EXIT);
 *  - ADJUSTMENT quantity=7 (absoluto) → balance=7, movimiento 10→7,
 *    auditoría STOCK_ADJUSTMENT;
 *  - EXIT con el rol "Ventas" (no tiene inventory.exit) → 403;
 *  - GET /inventory y GET /inventory/movements → 200 con {items, pagination}.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const { setup, teardown, login, assertOk, assertError } = require('./helpers');

const api = request(app);

let fx;
let token;       // administrador (todos los permisos)
let tokenVentas; // rol Ventas (sin inventory.exit)
let productId;

/** GET /inventory?productId=… → quantity del primer balance. */
async function getBalanceQuantity() {
  const res = await api
    .get(`/api/v1/inventory?productId=${productId}`)
    .set('Authorization', `Bearer ${token}`);
  assertOk(res, 200);
  assert.equal(res.body.data.items.length, 1, 'debía existir exactamente un balance');
  return res.body.data.items[0].quantity;
}

/** GET /audit?action=… → pagination.total. */
async function auditTotal(action) {
  const res = await api
    .get(`/api/v1/audit?action=${action}`)
    .set('Authorization', `Bearer ${token}`);
  assertOk(res, 200);
  return res.body.data.pagination.total;
}

/** GET /inventory/movements?type=… → {total, items}. */
async function movementsByType(type) {
  const res = await api
    .get(`/api/v1/inventory/movements?type=${type}`)
    .set('Authorization', `Bearer ${token}`);
  assertOk(res, 200);
  return res.body.data;
}

describe('INVENTARIO — movimientos, atomicidad de salida y permisos', () => {
  before(async () => {
    fx = await setup();
    token = await login(api, fx.admin.email, fx.admin.password);
    tokenVentas = await login(api, fx.ventas.email, fx.ventas.password);

    // Fixtures mínimos: categoría + producto.
    const cat = await api
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Inventario' });
    assertOk(cat, 201);

    const prod = await api
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sku: 'SKU-INV-001',
        name: 'Producto Inventario',
        categoryId: String(cat.body.data._id),
        purchasePrice: 5,
        salePrice: 9,
        stockMin: 3,
      });
    assertOk(prod, 201);
    productId = String(prod.body.data._id);
  });
  after(teardown);

  it('ENTRY de 10 → balance 10, movimiento 0→10 y auditoría STOCK_ENTRY', async () => {
    const res = await api
      .post('/api/v1/inventory/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId,
        warehouseId: fx.warehouseId,
        type: 'ENTRY',
        quantity: 10,
        reason: 'Entrada inicial',
      });

    assertOk(res, 201);
    assert.equal(res.body.data.type, 'ENTRY');
    assert.equal(res.body.data.quantity, 10);
    assert.equal(res.body.data.previousQuantity, 0);
    assert.equal(res.body.data.newQuantity, 10);

    assert.equal(await getBalanceQuantity(), 10);
    assert.ok((await auditTotal('STOCK_ENTRY')) >= 1, 'faltaba auditoría STOCK_ENTRY');
  });

  it('EXIT de 15 con balance 10 → 409 y el balance SIGUE en 10 (sin descuento parcial)', async () => {
    const res = await api
      .post('/api/v1/inventory/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId,
        warehouseId: fx.warehouseId,
        type: 'EXIT',
        quantity: 15,
        reason: 'Salida imposible',
      });

    assertError(res, 409, 'CONFLICT');
    assert.match(res.body.error.message, /Stock insuficiente/i);

    // Sin descuento parcial y sin movimiento registrado.
    assert.equal(await getBalanceQuantity(), 10);
    const exits = await movementsByType('EXIT');
    assert.equal(exits.pagination.total, 0, 'no debía crearse ningún movimiento EXIT');
  });

  it('ADJUSTMENT a 7 (absoluto) → balance 7, movimiento 10→7 y auditoría STOCK_ADJUSTMENT', async () => {
    const res = await api
      .post('/api/v1/inventory/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId,
        warehouseId: fx.warehouseId,
        type: 'ADJUSTMENT',
        quantity: 7,
        reason: 'Conteo físico',
      });

    assertOk(res, 201);
    assert.equal(res.body.data.type, 'ADJUSTMENT');
    assert.equal(res.body.data.previousQuantity, 10);
    assert.equal(res.body.data.newQuantity, 7);

    assert.equal(await getBalanceQuantity(), 7);
    assert.ok((await auditTotal('STOCK_ADJUSTMENT')) >= 1, 'faltaba auditoría STOCK_ADJUSTMENT');
  });

  it('EXIT con rol Ventas (sin inventory.exit) → 403 AUTHORIZATION_ERROR', async () => {
    const res = await api
      .post('/api/v1/inventory/movements')
      .set('Authorization', `Bearer ${tokenVentas}`)
      .send({
        productId,
        warehouseId: fx.warehouseId,
        type: 'EXIT',
        quantity: 1,
        reason: 'No debería poder',
      });

    assertError(res, 403, 'AUTHORIZATION_ERROR');
    assert.match(res.body.error.message, /inventory\.exit/);

    // Rechazo confirmado: el balance no se movió.
    assert.equal(await getBalanceQuantity(), 7);
  });

  it('GET /inventory y GET /inventory/movements → 200 con items', async () => {
    const balances = await api.get('/api/v1/inventory').set('Authorization', `Bearer ${token}`);
    assertOk(balances, 200);
    assert.ok(Array.isArray(balances.body.data.items));
    assert.equal(balances.body.data.items.length, 1);
    assert.equal(balances.body.data.items[0].quantity, 7);

    const movements = await api
      .get('/api/v1/inventory/movements')
      .set('Authorization', `Bearer ${token}`);
    assertOk(movements, 200);
    assert.ok(Array.isArray(movements.body.data.items));
    // ENTRY(10) + ADJUSTMENT(7): los dos movimientos exitosos.
    assert.equal(movements.body.data.pagination.total, 2);
  });
});
