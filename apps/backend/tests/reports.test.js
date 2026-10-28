'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { Types } = require('mongoose');

const app = require('../src/app');
const {
  setup,
  teardown,
  login,
  assertOk,
  assertError,
} = require('./helpers');
const Role = require('../src/modules/roles/model');
const User = require('../src/modules/users/model');
const Product = require('../src/modules/products/model');
const Sale = require('../src/modules/sales/model');
const Purchase = require('../src/modules/purchases/model');
const StockMovement = require('../src/modules/inventory/model').StockMovement;
const AuditLog = require('../src/modules/audit/model');
const { toCsv } = require('../src/utils/csv');

const api = request(app);
const REPORTS = [
  'sales',
  'purchases',
  'inventory',
  'movements',
  'products',
  'customers',
  'suppliers',
  'audit',
];
const REPORT_LIMIT = 5000;

let fx;
let tokenA;
let tokenB;
let tokenConsulta;
let tokenNoReports;
let companyBId;
const tenantData = {};

async function createTenantData(token, marker, productName = `${marker} producto`) {
  const categoryResponse = await api
    .post('/api/v1/categories')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `${marker} categoría` });
  assertOk(categoryResponse, 201);

  const supplierResponse = await api
    .post('/api/v1/suppliers')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: `${marker} proveedor`,
      email: `${marker.toLowerCase()}@supplier.test`,
      phone: '5512345678',
    });
  assertOk(supplierResponse, 201);

  const customerResponse = await api
    .post('/api/v1/customers')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: `${marker} cliente`,
      email: `${marker.toLowerCase()}@customer.test`,
      phone: '5512345679',
    });
  assertOk(customerResponse, 201);

  const warehouseResponse = await api
    .get('/api/v1/warehouses')
    .set('Authorization', `Bearer ${token}`);
  assertOk(warehouseResponse, 200);
  const warehouseId = String(warehouseResponse.body.data.items[0]._id);

  const productResponse = await api
    .post('/api/v1/products')
    .set('Authorization', `Bearer ${token}`)
    .send({
      sku: `${marker}-SKU-01`,
      name: productName,
      categoryId: String(categoryResponse.body.data._id),
      supplierId: String(supplierResponse.body.data._id),
      purchasePrice: 8,
      salePrice: 12,
      stockMin: 2,
    });
  assertOk(productResponse, 201);
  const productId = String(productResponse.body.data._id);

  const entryResponse = await api
    .post('/api/v1/inventory/movements')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId, warehouseId, type: 'ENTRY', quantity: 10, reason: `${marker} stock` });
  assertOk(entryResponse, 201);

  const purchaseResponse = await api
    .post('/api/v1/purchases')
    .set('Authorization', `Bearer ${token}`)
    .send({
      supplierId: String(supplierResponse.body.data._id),
      warehouseId,
      items: [{ productId, quantity: 5, unitPrice: 8 }],
    });
  assertOk(purchaseResponse, 201);
  const purchaseId = String(purchaseResponse.body.data._id);
  const confirmPurchase = await api
    .post(`/api/v1/purchases/${purchaseId}/confirm`)
    .set('Authorization', `Bearer ${token}`);
  assertOk(confirmPurchase, 200);
  const receivePurchase = await api
    .post(`/api/v1/purchases/${purchaseId}/receive`)
    .set('Authorization', `Bearer ${token}`);
  assertOk(receivePurchase, 200);

  const saleResponse = await api
    .post('/api/v1/sales')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customerId: String(customerResponse.body.data._id),
      warehouseId,
      items: [{ productId, quantity: 2, unitPrice: 12 }],
    });
  assertOk(saleResponse, 201);
  const saleId = String(saleResponse.body.data._id);
  const confirmSale = await api
    .post(`/api/v1/sales/${saleId}/confirm`)
    .set('Authorization', `Bearer ${token}`);
  assertOk(confirmSale, 200);

  const draftSale = await api
    .post('/api/v1/sales')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customerId: String(customerResponse.body.data._id),
      warehouseId,
      items: [{ productId, quantity: 1, unitPrice: 12 }],
    });
  assertOk(draftSale, 201);

  const auditFixture = await AuditLog.create({
    companyId: marker === 'K1_ALPHA' ? fx.companyId : companyBId,
    userId: marker === 'K1_ALPHA' ? fx.admin.id : (await User.findOne({ companyId: companyBId }).select('_id').lean())._id,
    action: 'LOGIN_FAILED',
    module: 'auth',
    description: `${marker} audit fixture`,
  });

  return {
    marker,
    companyId: marker === 'K1_ALPHA' ? fx.companyId : companyBId,
    categoryId: String(categoryResponse.body.data._id),
    supplierId: String(supplierResponse.body.data._id),
    customerId: String(customerResponse.body.data._id),
    warehouseId,
    productId,
    purchaseId,
    saleId,
    auditId: String(auditFixture._id),
  };
}

function reportRequest(token, report, query = {}) {
  return api.get(`/api/v1/reports/${report}`)
    .set('Authorization', `Bearer ${token}`)
    .query(query);
}

describe('REPORTES — ocho tipos, JSON/CSV, permisos y aislamiento', () => {
  before(async () => {
    fx = await setup();
    tokenA = await login(api, fx.admin.email, fx.admin.password);

    const company = await api
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Empresa Reportes Beta', email: 'beta-reportes@test.local' });
    assertOk(company, 201);
    companyBId = String(company.body.data._id);

    const roleB = await Role.findOne({ companyId: companyBId, name: 'Administrador' }).lean();
    const userB = await api
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        firstName: 'Admin',
        lastName: 'Reportes Beta',
        email: 'admin-reportes-beta@test.local',
        password: 'ReportesBeta123!',
        roleId: String(roleB._id),
        companyId: companyBId,
      });
    assertOk(userB, 201);
    tokenB = await login(api, 'admin-reportes-beta@test.local', 'ReportesBeta123!');

    tenantData.alpha = await createTenantData(tokenA, 'K1_ALPHA', '=1+1');
    tenantData.beta = await createTenantData(tokenB, 'K1_BETA');

    const consultaToken = await login(api, fx.consulta.email, fx.consulta.password);
    tokenConsulta = consultaToken;

    const noReportsRole = await Role.create({
      name: 'Sin reportes',
      companyId: fx.companyId,
      permissions: ['products.read'],
      status: 'active',
    });
    const noReportsUser = await User.create({
      firstName: 'Sin',
      lastName: 'Reportes',
      email: 'sin-reportes@test.local',
      password: 'SinReportes123!',
      roleId: noReportsRole._id,
      companyId: fx.companyId,
    });
    tokenNoReports = await login(api, noReportsUser.email, 'SinReportes123!');
  });

  after(teardown);

  it('cada uno de los ocho reportes devuelve JSON con datos reales y aislados por empresa', async () => {
    for (const report of REPORTS) {
      for (const [token, ownMarker, foreignMarker] of [
        [tokenA, 'K1_ALPHA', 'K1_BETA'],
        [tokenB, 'K1_BETA', 'K1_ALPHA'],
      ]) {
        const response = await reportRequest(token, report);
        assertOk(response, 200);
        assert.equal(response.body.data.report, report);
        assert.ok(Array.isArray(response.body.data.rows), `${report} debe devolver rows`);
        assert.equal(response.body.data.count, response.body.data.rows.length);
        assert.ok(
          response.body.data.rows.length > 0,
          `${report} debía incluir registros reales de ${ownMarker}`
        );
        const body = JSON.stringify(response.body.data.rows);
        assert.ok(body.includes(ownMarker), `${report} debía incluir datos de ${ownMarker}`);
        assert.ok(!body.includes(foreignMarker), `${report} filtró datos de ${foreignMarker}`);
      }
    }
  });

  it('los ocho CSV tienen cabecera, filas aisladas y evento EXPORT_REPORT por empresa', async () => {
    for (const report of REPORTS) {
      for (const [token, ownMarker, foreignMarker, companyId] of [
        [tokenA, 'K1_ALPHA', 'K1_BETA', fx.companyId],
        [tokenB, 'K1_BETA', 'K1_ALPHA', companyBId],
      ]) {
        const response = await reportRequest(token, report, { format: 'csv' });
        assert.equal(response.status, 200, `${report} CSV debía responder 200`);
        assert.match(response.headers['content-type'], /text\/csv/i);
        assert.ok(response.text.startsWith('\uFEFF'), `${report} CSV debe incluir BOM`);
        assert.ok(response.text.includes(ownMarker), `${report} CSV debía incluir ${ownMarker}`);
        assert.ok(!response.text.includes(foreignMarker), `${report} CSV filtró ${foreignMarker}`);
        assert.match(response.text, /\r\n/, `${report} CSV debe separar filas con CRLF`);

        const audit = await AuditLog.findOne({
          companyId,
          action: 'EXPORT_REPORT',
          module: 'reports',
          entity: 'report',
          entityId: report,
          description: new RegExp(`Exportación CSV del reporte ${report}`),
        }).lean();
        assert.ok(audit, `faltó el evento de exportación ${report} en ${ownMarker}`);
      }
    }
  });

  it('los filtros de estado, referencias y fechas limitan los resultados; incluye extremos del día', async () => {
    const alpha = tenantData.alpha;
    const historicalDate = new Date('2024-04-15T12:00:00.000Z');
    await Sale.collection.updateMany(
      { companyId: Types.ObjectId.createFromHexString(alpha.companyId) },
      { $set: { createdAt: historicalDate } }
    );
    await Purchase.collection.updateOne(
      { _id: Types.ObjectId.createFromHexString(alpha.purchaseId) },
      { $set: { createdAt: historicalDate } }
    );
    await StockMovement.collection.updateMany(
      { companyId: Types.ObjectId.createFromHexString(alpha.companyId) },
      { $set: { createdAt: historicalDate } }
    );
    await AuditLog.collection.updateOne(
      { _id: Types.ObjectId.createFromHexString(alpha.auditId) },
      { $set: { createdAt: historicalDate } }
    );

    const datedSales = await reportRequest(tokenA, 'sales', {
      dateFrom: '2024-04-15',
      dateTo: '2024-04-15',
    });
    assertOk(datedSales, 200);
    assert.equal(datedSales.body.data.count, 2);

    const confirmed = await reportRequest(tokenA, 'sales', { status: 'CONFIRMED' });
    assertOk(confirmed, 200);
    assert.equal(confirmed.body.data.count, 1);
    assert.equal(confirmed.body.data.rows[0].estado, 'CONFIRMED');
    assert.equal(confirmed.body.data.rows[0].subtotal, 24);
    assert.equal(confirmed.body.data.rows[0].impuestos, 5.04);
    assert.equal(confirmed.body.data.rows[0].total, 29.04);

    const warehouseSales = await reportRequest(tokenA, 'sales', {
      warehouseId: alpha.warehouseId,
      userId: fx.admin.id,
    });
    assertOk(warehouseSales, 200);
    assert.equal(warehouseSales.body.data.count, 2);

    const receivedPurchases = await reportRequest(tokenA, 'purchases', {
      status: 'RECEIVED',
      warehouseId: alpha.warehouseId,
      userId: fx.admin.id,
    });
    assertOk(receivedPurchases, 200);
    assert.equal(receivedPurchases.body.data.count, 1);
    assert.equal(receivedPurchases.body.data.rows[0].subtotal, 40);
    assert.equal(receivedPurchases.body.data.rows[0].impuestos, 8.4);
    assert.equal(receivedPurchases.body.data.rows[0].total, 48.4);

    const inventory = await reportRequest(tokenA, 'inventory', {
      warehouseId: alpha.warehouseId,
    });
    assertOk(inventory, 200);
    assert.equal(inventory.body.data.count, 1);
    assert.equal(inventory.body.data.rows[0].existencia, 13);

    const movements = await reportRequest(tokenA, 'movements', {
      type: 'ENTRY',
      warehouseId: alpha.warehouseId,
      productId: alpha.productId,
      userId: fx.admin.id,
      dateFrom: '2024-04-15',
      dateTo: '2024-04-15',
    });
    assertOk(movements, 200);
    assert.equal(movements.body.data.count, 2);
    assert.ok(movements.body.data.rows.every((row) => row.tipo === 'ENTRY'));
    assert.equal(
      movements.body.data.rows.reduce((sum, row) => sum + row.cantidad, 0),
      15
    );

    const saleMovements = await reportRequest(tokenA, 'movements', {
      type: 'EXIT',
      productId: alpha.productId,
    });
    assertOk(saleMovements, 200);
    assert.equal(saleMovements.body.data.count, 1);
    assert.equal(saleMovements.body.data.rows[0].cantidad, 2);
    assert.equal(saleMovements.body.data.rows[0].nueva, 13);

    const products = await reportRequest(tokenA, 'products', {
      status: 'active',
      categoryId: alpha.categoryId,
      supplierId: alpha.supplierId,
    });
    assertOk(products, 200);
    assert.equal(products.body.data.count, 1);

    const customers = await reportRequest(tokenA, 'customers', { status: 'active' });
    assertOk(customers, 200);
    assert.equal(customers.body.data.count, 1);

    const suppliers = await reportRequest(tokenA, 'suppliers', { status: 'active' });
    assertOk(suppliers, 200);
    assert.equal(suppliers.body.data.count, 1);

    const audit = await reportRequest(tokenA, 'audit', {
      action: 'LOGIN_FAILED',
      module: 'auth',
      userId: fx.admin.id,
      dateFrom: '2024-04-15',
      dateTo: '2024-04-15',
    });
    assertOk(audit, 200);
    assert.equal(audit.body.data.count, 1);
    assert.ok(audit.body.data.rows[0].descripcion.includes('K1_ALPHA'));
  });

  it('rechaza filtros inválidos, devuelve resultados vacíos y documenta que reportes no paginan', async () => {
    const invalidDate = await reportRequest(tokenA, 'sales', { dateFrom: 'no-es-fecha' });
    assertError(invalidDate, 400, 'VALIDATION_ERROR');

    const invalidStatus = await reportRequest(tokenA, 'sales', { status: 'INVALID' });
    assertError(invalidStatus, 400, 'VALIDATION_ERROR');

    const invalidId = await reportRequest(tokenA, 'inventory', { warehouseId: 'not-an-object-id' });
    assertError(invalidId, 400, 'VALIDATION_ERROR');

    const invalidFormat = await reportRequest(tokenA, 'sales', { format: 'json' });
    assertError(invalidFormat, 400, 'VALIDATION_ERROR');

    const empty = await reportRequest(tokenA, 'sales', { dateFrom: '2099-01-01' });
    assertOk(empty, 200);
    assert.equal(empty.body.data.count, 0);
    assert.deepEqual(empty.body.data.rows, []);

    const noPagination = await reportRequest(tokenA, 'sales', { page: 2, limit: 1 });
    assertOk(noPagination, 200);
    assert.equal(noPagination.body.data.count, 2);
    assert.equal(noPagination.body.data.pagination, undefined);
  });

  it('exige reports.read y reports.export según el formato solicitado', async () => {
    const readOnlyJson = await reportRequest(tokenConsulta, 'products');
    assertOk(readOnlyJson, 200);

    const readOnlyCsv = await reportRequest(tokenConsulta, 'products', { format: 'csv' });
    assertError(readOnlyCsv, 403, 'AUTHORIZATION_ERROR');
    assert.match(readOnlyCsv.body.error.message, /reports\.export/);

    const noReadJson = await reportRequest(tokenNoReports, 'products');
    assertError(noReadJson, 403, 'AUTHORIZATION_ERROR');
    assert.match(noReadJson.body.error.message, /reports\.read/);

    const noReadCsv = await reportRequest(tokenNoReports, 'products', { format: 'csv' });
    assertError(noReadCsv, 403, 'AUTHORIZATION_ERROR');
    assert.match(noReadCsv.body.error.message, /reports\.read/);
  });

  it('limita el tamaño de las consultas al máximo fijo de 5.000 filas', async () => {
    const originalFind = Product.find;
    const rows = Array.from({ length: REPORT_LIMIT + 1 }, (_, index) => ({
      sku: `LIMIT-${index}`,
      name: 'Fila límite',
      categoryId: null,
      supplierId: null,
      purchasePrice: 1,
      salePrice: 2,
      stockMin: 0,
      unit: 'unidad',
      status: 'active',
    }));
    let requestedLimit;

    Product.find = function mockedFind() {
      const query = {
        populate() { return this; },
        sort() { return this; },
        limit(value) {
          requestedLimit = value;
          this.rows = rows.slice(0, value);
          return this;
        },
        lean() { return Promise.resolve(this.rows); },
      };
      return query;
    };

    try {
      const response = await reportRequest(tokenA, 'products');
      assertOk(response, 200);
      assert.equal(requestedLimit, REPORT_LIMIT);
      assert.equal(response.body.data.count, REPORT_LIMIT);
    } finally {
      Product.find = originalFind;
    }
  });

  it('el JSON conserva texto y la exportación CSV neutraliza celdas iniciadas como fórmula', async () => {
    const json = await reportRequest(tokenA, 'products');
    assertOk(json, 200);
    assert.equal(
      json.body.data.rows.find((row) => row.sku === 'K1_ALPHA-SKU-01').nombre,
      '=1+1'
    );

    const csv = await reportRequest(tokenA, 'products', { format: 'csv' });
    assert.equal(csv.status, 200);
    assert.ok(csv.text.includes("'=1+1"), 'CSV debe neutralizar la fórmula añadiendo apóstrofo');
    assert.ok(!csv.text.includes('\r\n=1+1,'), 'CSV no debe emitir una celda ejecutable');

    const formulaCells = toCsv([
      { equals: '=1+1', plus: '+SUM(A1:A2)', minus: '-2+3', at: '@SUM(A1:A2)', number: -5 },
    ]);
    assert.ok(formulaCells.includes("'=1+1"));
    assert.ok(formulaCells.includes("'+SUM(A1:A2)"));
    assert.ok(formulaCells.includes("'-2+3"));
    assert.ok(formulaCells.includes("'@SUM(A1:A2)"));
    assert.ok(formulaCells.endsWith(',-5\r\n'), 'los números negativos no deben convertirse en texto');
  });
});
