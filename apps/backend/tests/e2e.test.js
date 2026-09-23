'use strict';

/**
 * tests/e2e.test.js — ESCENARIO COMPLETO DE EXTREMO A EXTREMO (spec §33)
 *
 * Un único recorrido con asserts en cada paso, usando su propia empresa
 * ("Empresa E2E") para no depender de otros archivos de la suite:
 *  (1)  crear empresa vía API (201 y aprovisionada: 6 roles),
 *  (2)  crear un usuario administrador en ella,
 *  (3)  el rol queda asignado (roleId + companyId del usuario),
 *  (4)  login de ese usuario y perfil (/auth/me),
 *  (5)  crear proveedor,
 *  (6)  crear categoría,
 *  (7)  crear producto,
 *  (8)  registrar compra (DRAFT con totales IVA 21%),
 *  (9)  confirmar + recibir compra,
 *  (10) inventario = subtotal recibido (20 unidades),
 *  (11) crear cliente,
 *  (12) registrar venta + confirmar,
 *  (13) inventario = recibido − vendido (20 − 5 = 15),
 *  (14) movimientos: existen ENTRY y EXIT,
 *  (15) auditoría: existen CONFIRM_SALE y RECEIVE_PURCHASE,
 *  (16) dashboard: kpi.totalProducts ≥ 1 y salesMonth > 0,
 *  (17) usuario Consulta intenta POST /products sin permiso,
 *  (18) rechazo confirmado: 403 AUTHORIZATION_ERROR y sobre {success:false}.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const { setup, teardown, login, assertOk, assertError } = require('./helpers');
const Role = require('../src/modules/roles/model');

const api = request(app);

let fx;
let tokenA;      // admin de Empresa Alfa (crea la empresa E2E)
let idE;         // id de "Empresa E2E"
let tokenE;      // admin de Empresa E2E
let supplierId;
let categoryId;
let productId;
let warehouseId;
let purchaseId;
let customerId;
let saleId;
let tokenConsulta; // usuario de solo lectura en Empresa E2E

const RECEIVED_QTY = 20;
const SOLD_QTY = 5;

/** GET /inventory?productId=… → quantity. */
async function getBalanceQuantity(token) {
  const res = await api
    .get(`/api/v1/inventory?productId=${productId}`)
    .set('Authorization', `Bearer ${token}`);
  assertOk(res, 200);
  assert.equal(res.body.data.items.length, 1);
  return res.body.data.items[0].quantity;
}

/** GET /inventory/movements?type=… → pagination.total. */
async function movementTotal(token, type) {
  const res = await api
    .get(`/api/v1/inventory/movements?type=${type}`)
    .set('Authorization', `Bearer ${token}`);
  assertOk(res, 200);
  return res.body.data.pagination.total;
}

/** GET /audit?action=… → pagination.total. */
async function auditTotal(token, action) {
  const res = await api
    .get(`/api/v1/audit?action=${action}`)
    .set('Authorization', `Bearer ${token}`);
  assertOk(res, 200);
  return res.body.data.pagination.total;
}

describe('E2E — escenario completo del negocio (spec §33)', () => {
  before(async () => {
    fx = await setup();
    tokenA = await login(api, fx.admin.email, fx.admin.password);
  });
  after(teardown);

  it('(1-4) crea la empresa por API, su usuario admin, le asigna el rol y hace login', async () => {
    // (1) Crear empresa vía API → 201 + aprovisionamiento de 6 roles.
    const company = await api
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Empresa E2E', taxId: 'E-33333333', email: 'e2e@test.local' });
    assertOk(company, 201);
    assert.equal(company.body.data.name, 'Empresa E2E');
    idE = String(company.body.data._id);
    assert.equal(await Role.countDocuments({ companyId: idE }), 6);

    // (2) Crear el usuario administrador EN esa empresa (cross-company).
    // Los roles de E no son visibles desde el API de A → se leen de BD (permitido en tests).
    const roleEAdmin = await Role.findOne({ companyId: idE, name: 'Administrador' }).lean();
    assert.ok(roleEAdmin, 'faltaba el rol Administrador de E');

    const user = await api
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        firstName: 'E2E',
        lastName: 'Admin',
        email: 'admin-e2e@test.local',
        password: 'Admin12345!',
        roleId: String(roleEAdmin._id),
        companyId: idE,
      });
    assertOk(user, 201);

    // (3) Rol asignado correctamente al usuario de E.
    assert.equal(user.body.data.roleId, String(roleEAdmin._id));
    assert.equal(user.body.data.companyId, idE);

    // (4) Login de ese usuario + perfil con rol y empresa propios.
    tokenE = await login(api, 'admin-e2e@test.local', 'Admin12345!');
    const me = await api.get('/api/v1/auth/me').set('Authorization', `Bearer ${tokenE}`);
    assertOk(me, 200);
    assert.equal(me.body.data.company.id, idE);
    assert.equal(me.body.data.role.name, 'Administrador');
  });

  it('(5-7) crea proveedor, categoría y producto en la empresa E2E', async () => {
    const sup = await api
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${tokenE}`)
      .send({ name: 'Proveedor E2E', email: 'prov@e2e.test' });
    assertOk(sup, 201);
    assert.equal(sup.body.data.companyId, idE);
    supplierId = String(sup.body.data._id);

    const cat = await api
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${tokenE}`)
      .send({ name: 'Categoría E2E' });
    assertOk(cat, 201);
    assert.equal(cat.body.data.companyId, idE);
    categoryId = String(cat.body.data._id);

    const prod = await api
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${tokenE}`)
      .send({
        sku: 'SKU-E2E-001',
        name: 'Producto E2E',
        categoryId,
        purchasePrice: 8,
        salePrice: 15,
      });
    assertOk(prod, 201);
    assert.equal(prod.body.data.companyId, idE);
    productId = String(prod.body.data._id);

    // Almacén aprovisionado automáticamente al crear la empresa.
    const warehouses = await api
      .get('/api/v1/warehouses')
      .set('Authorization', `Bearer ${tokenE}`);
    assertOk(warehouses, 200);
    assert.equal(warehouses.body.data.items.length, 1);
    warehouseId = String(warehouses.body.data.items[0]._id);
  });

  it('(8) registra la compra en DRAFT con los totales calculados (IVA 21%)', async () => {
    const res = await api
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${tokenE}`)
      .send({
        supplierId,
        warehouseId,
        items: [{ productId, quantity: RECEIVED_QTY, unitPrice: 10 }],
      });

    assertOk(res, 201);
    assert.equal(res.body.data.status, 'DRAFT');
    assert.equal(res.body.data.subtotal, 200); // 20 * 10
    assert.equal(res.body.data.tax, 42);       // 200 * 0.21
    assert.equal(res.body.data.total, 242);
    purchaseId = String(res.body.data._id);
  });

  it('(9-10) confirma y recibe la compra; el inventario cuadra con lo recibido', async () => {
    const confirm = await api
      .post(`/api/v1/purchases/${purchaseId}/confirm`)
      .set('Authorization', `Bearer ${tokenE}`);
    assertOk(confirm, 200);
    assert.equal(confirm.body.data.status, 'CONFIRMED');

    const receive = await api
      .post(`/api/v1/purchases/${purchaseId}/receive`)
      .set('Authorization', `Bearer ${tokenE}`);
    assertOk(receive, 200);
    assert.equal(receive.body.data.status, 'RECEIVED');

    // (10) balance = subtotal recibido (en unidades: la suma de los items).
    assert.equal(await getBalanceQuantity(tokenE), RECEIVED_QTY);
  });

  it('(11) crea el cliente', async () => {
    const res = await api
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${tokenE}`)
      .send({ name: 'Cliente E2E', email: 'cliente@e2e.test' });

    assertOk(res, 201);
    assert.equal(res.body.data.companyId, idE);
    assert.match(res.body.data.customerCode, /^CL-\d{5}$/);
    customerId = String(res.body.data._id);
  });

  it('(12-13) registra la venta, la confirma y el inventario queda recibido − vendido', async () => {
    const sale = await api
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${tokenE}`)
      .send({
        customerId,
        warehouseId,
        items: [{ productId, quantity: SOLD_QTY, unitPrice: 15 }],
      });
    assertOk(sale, 201);
    assert.equal(sale.body.data.status, 'DRAFT');
    saleId = String(sale.body.data._id);

    const confirm = await api
      .post(`/api/v1/sales/${saleId}/confirm`)
      .set('Authorization', `Bearer ${tokenE}`);
    assertOk(confirm, 200);
    assert.equal(confirm.body.data.status, 'CONFIRMED');

    // (13) balance = recibido − vendido.
    assert.equal(await getBalanceQuantity(tokenE), RECEIVED_QTY - SOLD_QTY);
  });

  it('(14) el historial de movimientos contiene ENTRY y EXIT', async () => {
    assert.ok((await movementTotal(tokenE, 'ENTRY')) >= 1, 'faltaba el movimiento ENTRY');
    assert.ok((await movementTotal(tokenE, 'EXIT')) >= 1, 'faltaba el movimiento EXIT');
  });

  it('(15) la auditoría registra CONFIRM_SALE y RECEIVE_PURCHASE', async () => {
    assert.ok(
      (await auditTotal(tokenE, 'CONFIRM_SALE')) >= 1,
      'faltaba la auditoría CONFIRM_SALE'
    );
    assert.ok(
      (await auditTotal(tokenE, 'RECEIVE_PURCHASE')) >= 1,
      'faltaba la auditoría RECEIVE_PURCHASE'
    );
  });

  it('(16) el dashboard muestra indicadores reales (totalProducts ≥ 1, salesMonth > 0)', async () => {
    const res = await api.get('/api/v1/dashboard').set('Authorization', `Bearer ${tokenE}`);

    assertOk(res, 200);
    assert.ok(res.body.data.kpi.totalProducts >= 1, 'kpi.totalProducts debía ser ≥ 1');
    assert.ok(res.body.data.kpi.salesMonth > 0, 'kpi.salesMonth debía ser > 0 tras confirmar');
    assert.equal(res.body.data.kpi.totalCustomers, 1);
    assert.ok(res.body.data.kpi.purchasesMonth > 0);
  });

  it('(17-18) usuario Consulta intenta crear un producto → 403 AUTHORIZATION_ERROR', async () => {
    // Usuario de solo lectura en la empresa E2E.
    const roleEConsulta = await Role.findOne({ companyId: idE, name: 'Consulta' }).lean();
    assert.ok(roleEConsulta, 'faltaba el rol Consulta de E');

    const created = await api
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${tokenE}`)
      .send({
        firstName: 'Solo',
        lastName: 'Lectura',
        email: 'consulta-e2e@test.local',
        password: 'Consulta12345!',
        roleId: String(roleEConsulta._id),
      });
    assertOk(created, 201);
    assert.equal(created.body.data.companyId, idE);

    tokenConsulta = await login(api, 'consulta-e2e@test.local', 'Consulta12345!');

    const res = await api
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${tokenConsulta}`)
      .send({ sku: 'SKU-NO-PERMITIDO', name: 'No Puede', categoryId, purchasePrice: 1, salePrice: 2 });

    // (18) Rechazo confirmado con el sobre de error exacto.
    assertError(res, 403, 'AUTHORIZATION_ERROR');
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'AUTHORIZATION_ERROR');
  });
});
