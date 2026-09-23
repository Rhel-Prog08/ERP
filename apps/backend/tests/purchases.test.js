'use strict';

/**
 * tests/purchases.test.js — SUITE DE COMPRAS (FLUJO B)
 *
 * Qué verifica:
 *  - POST /purchases → DRAFT con totales calculados en servidor (IVA 21%:
 *    subtotal 40, tax 8.4, total 48.4);
 *  - confirm → CONFIRMED;
 *  - receive → RECEIVED + balance +N + movimiento ENTRY prev 0/new N +
 *    product.purchasePrice actualizado + auditoría RECEIVE_PURCHASE;
 *  - recibir dos veces → la 2ª → 409 CONFLICT (sin efectos adicionales);
 *  - cancelar una compra DRAFT → CANCELLED SIN crear movimiento;
 *  - cancelar la compra RECEIVED → CANCELLED + movimiento EXIT de reversa +
 *    auditoría CANCEL_PURCHASE + el balance vuelve al valor previo (0).
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const { setup, teardown, login, assertOk, assertError } = require('./helpers');

const api = request(app);

let fx;
let token;
let supplierId;
let productId;
let purchaseMain; // compra del flujo completo (RECIBIDA y luego cancelada)
let purchaseDraft; // compra borrador (se cancela sin efectos)

const QTY = 4;
const UNIT_PRICE = 10;

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

describe('COMPRAS — alta, recepción con stock y cancelaciones', () => {
  before(async () => {
    fx = await setup();
    token = await login(api, fx.admin.email, fx.admin.password);

    // Fixtures: categoría + producto + proveedor.
    const cat = await api
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Compras' });
    assertOk(cat, 201);

    const prod = await api
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sku: 'SKU-COMPRA-001',
        name: 'Producto Comprado',
        categoryId: String(cat.body.data._id),
        purchasePrice: 8, // se sobrescribirá con el precio de recepción
        salePrice: 20,
      });
    assertOk(prod, 201);
    productId = String(prod.body.data._id);

    const sup = await api
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Proveedor Uno', email: 'prov@uno.test' });
    assertOk(sup, 201);
    supplierId = String(sup.body.data._id);
  });
  after(teardown);

  it('POST /purchases → DRAFT con totales calculados (IVA 21%)', async () => {
    const res = await api
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({
        supplierId,
        warehouseId: fx.warehouseId,
        items: [{ productId, quantity: QTY, unitPrice: UNIT_PRICE }],
        notes: 'Compra de prueba',
      });

    assertOk(res, 201);
    assert.equal(res.body.data.status, 'DRAFT');
    assert.equal(res.body.data.subtotal, 40);
    assert.equal(res.body.data.tax, 8.4); // 40 * 0.21
    assert.equal(res.body.data.total, 48.4);
    assert.equal(res.body.data.items[0].subtotal, 40);
    assert.equal(res.body.data.items[0].sku, 'SKU-COMPRA-001');
    assert.equal(res.body.data.companyId, fx.companyId);
    purchaseMain = String(res.body.data._id);
  });

  it('POST /purchases/:id/confirm → CONFIRMED (sin efecto de stock todavía)', async () => {
    const res = await api
      .post(`/api/v1/purchases/${purchaseMain}/confirm`)
      .set('Authorization', `Bearer ${token}`);

    assertOk(res, 200);
    assert.equal(res.body.data.status, 'CONFIRMED');
    assert.ok(res.body.data.confirmedAt);

    // Confirmar aún no mueve inventario.
    const entries = await movementsByType('ENTRY');
    assert.equal(entries.pagination.total, 0);
  });

  it('receive → RECEIVED + balance +N + ENTRY 0→N + purchasePrice + audit RECEIVE_PURCHASE', async () => {
    const res = await api
      .post(`/api/v1/purchases/${purchaseMain}/receive`)
      .set('Authorization', `Bearer ${token}`);

    assertOk(res, 200);
    assert.equal(res.body.data.status, 'RECEIVED');
    assert.ok(res.body.data.receivedAt);

    // Inventario sumado.
    assert.equal(await getBalanceQuantity(), QTY);

    // Movimiento ENTRY con trazabilidad 0 → 4.
    const entries = await movementsByType('ENTRY');
    assert.equal(entries.pagination.total, 1);
    assert.equal(entries.items[0].type, 'ENTRY');
    assert.equal(entries.items[0].previousQuantity, 0);
    assert.equal(entries.items[0].newQuantity, QTY);
    assert.equal(entries.items[0].referenceType, 'PURCHASE');
    assert.equal(entries.items[0].referenceId, purchaseMain);

    // Integración: el coste de compra del producto queda actualizado.
    const product = await api
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${token}`);
    assertOk(product, 200);
    assert.equal(product.body.data.purchasePrice, UNIT_PRICE);

    assert.ok((await auditTotal('RECEIVE_PURCHASE')) >= 1, 'faltaba auditoría RECEIVE_PURCHASE');
  });

  it('recibir dos veces → la 2ª → 409 CONFLICT y el balance no cambia', async () => {
    const res = await api
      .post(`/api/v1/purchases/${purchaseMain}/receive`)
      .set('Authorization', `Bearer ${token}`);

    assertError(res, 409, 'CONFLICT');
    assert.match(res.body.error.message, /confirmada/i);
    assert.equal(await getBalanceQuantity(), QTY);
  });

  it('cancelar una compra DRAFT → CANCELLED sin crear movimiento', async () => {
    const draft = await api
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({
        supplierId,
        warehouseId: fx.warehouseId,
        items: [{ productId, quantity: 1, unitPrice: UNIT_PRICE }],
      });
    assertOk(draft, 201);
    purchaseDraft = String(draft.body.data._id);

    const before = await movementsByType('ENTRY');
    const totalBefore = before.pagination.total;

    const cancel = await api
      .post(`/api/v1/purchases/${purchaseDraft}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cancelReason: 'No hace falta' });

    assertOk(cancel, 200);
    assert.equal(cancel.body.data.status, 'CANCELLED');

    // Ni movimiento nuevo ni cambio de stock.
    const after = await movementsByType('ENTRY');
    assert.equal(after.pagination.total, totalBefore);
    assert.equal(await getBalanceQuantity(), QTY);
    assert.ok((await auditTotal('CANCEL_PURCHASE')) >= 1, 'faltaba auditoría CANCEL_PURCHASE');
  });

  it('cancelar la compra RECEIVED → CANCELLED + EXIT de reversa + balance vuelve a 0', async () => {
    const cancel = await api
      .post(`/api/v1/purchases/${purchaseMain}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cancelReason: 'Error en el pedido' });

    assertOk(cancel, 200);
    assert.equal(cancel.body.data.status, 'CANCELLED');
    assert.equal(cancel.body.data.cancelReason, 'Error en el pedido');

    // Reversa: movimiento EXIT que devuelve el stock.
    const exits = await movementsByType('EXIT');
    assert.equal(exits.pagination.total, 1);
    assert.equal(exits.items[0].type, 'EXIT');
    assert.equal(exits.items[0].previousQuantity, QTY);
    assert.equal(exits.items[0].newQuantity, 0);
    assert.equal(exits.items[0].referenceType, 'PURCHASE');
    assert.equal(exits.items[0].referenceId, purchaseMain);

    assert.equal(await getBalanceQuantity(), 0);

    // Auditoría de cancelación (la del DRAFT ya contó una entrada antes).
    assert.ok((await auditTotal('CANCEL_PURCHASE')) >= 2);
  });
});
