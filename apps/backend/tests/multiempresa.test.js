'use strict';

/**
 * tests/multiempresa.test.js — SUITE MULTIEMPRESA (aislamiento de tenants)
 *
 * Qué verifica:
 *  - POST /companies (admin de A) crea la "Empresa Beta" → 201 y la
 *    aprovisiona (6 roles + almacén principal + settings);
 *  - POST /users cross-company crea el administrador de B con un rol
 *    PERTENECIENTE a B (roleId obtenido directo de la colección Role);
 *  - login como usuario de B → token que opera sobre la empresa B;
 *  - cada empresa crea su cliente: B ve el suyo y recibe 404 NOT_FOUND
 *    ("ACCESO DENEGADO cross-company") al pedir el de A, y el listado de B
 *    NO incluye clientes de A;
 *  - B → PATCH /companies/<idA> → 404 (A queda intacta);
 *  - B → GET /dashboard → 200 con kpi.totalCustomers=1 (sólo los suyos).
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const { setup, teardown, login, assertOk, assertError } = require('./helpers');
const Role = require('../src/modules/roles/model');
const Warehouse = require('../src/modules/warehouses/model');
const Settings = require('../src/modules/settings/model');

const api = request(app);

const B_EMAIL = 'admin-beta@test.local';
const B_PASSWORD = 'Admin12345!';

let fx;
let tokenA;
let idB;
let roleBAdmin;
let tokenB;
let customerA;
let customerB;

describe('MULTIEMPRESA — aprovisionamiento y aislamiento entre empresas', () => {
  before(async () => {
    fx = await setup();
    tokenA = await login(api, fx.admin.email, fx.admin.password);
  });
  after(teardown);

  it('POST /companies crea y aprovisiona Empresa Beta (201: roles + almacén + settings)', async () => {
    const res = await api
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Empresa Beta', taxId: 'B-22222222', email: 'beta@test.local' });

    assertOk(res, 201);
    assert.equal(res.body.data.name, 'Empresa Beta');
    assert.equal(res.body.data.status, 'active');
    idB = String(res.body.data._id);

    // Aprovisionamiento atómico: 6 roles + almacén principal + settings.
    const rolesB = await Role.countDocuments({ companyId: idB });
    assert.equal(rolesB, 6, `esperaba 6 roles en B, hay ${rolesB}`);

    const adminRoleB = await Role.findOne({ companyId: idB, name: 'Administrador' }).lean();
    assert.ok(adminRoleB, 'faltaba el rol Administrador de B');
    assert.equal(adminRoleB.isSystem, true);
    roleBAdmin = adminRoleB;

    const warehouseB = await Warehouse.findOne({ companyId: idB, name: 'Almacén Principal' });
    assert.ok(warehouseB, 'faltaba el Almacén Principal de B');

    const settingsB = await Settings.findOne({ companyId: idB });
    assert.ok(settingsB, 'faltaban los settings de B');
    assert.equal(settingsB.taxRate, 0.21);
  });

  it('POST /users cross-company crea el admin de B con el rol de B (201)', async () => {
    const res = await api
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        firstName: 'Admin',
        lastName: 'Beta',
        email: B_EMAIL,
        password: B_PASSWORD,
        roleId: String(roleBAdmin._id),
        companyId: idB, // alta cross-company (exige companies.create)
      });

    assertOk(res, 201);
    assert.equal(res.body.data.email, B_EMAIL);
    assert.equal(res.body.data.companyId, idB);
    assert.equal(res.body.data.roleId, String(roleBAdmin._id));
    assert.equal(res.body.data.status, 'active');
  });

  it('login como usuario de B → token que actúa sobre la empresa B', async () => {
    tokenB = await login(api, B_EMAIL, B_PASSWORD);

    const me = await api.get('/api/v1/auth/me').set('Authorization', `Bearer ${tokenB}`);
    assertOk(me, 200);
    assert.equal(me.body.data.company.id, idB);
    assert.equal(me.body.data.company.name, 'Empresa Beta');
    assert.equal(me.body.data.role.name, 'Administrador');
  });

  it('B y A crean clientes: B obtiene 404 cross-company y el listado no incluye el de A', async () => {
    const resB = await api
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Cliente Beta' });
    assertOk(resB, 201);
    assert.equal(resB.body.data.companyId, idB);
    customerB = String(resB.body.data._id);

    const resA = await api
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Cliente Alfa' });
    assertOk(resA, 201);
    assert.equal(resA.body.data.companyId, fx.companyId);
    customerA = String(resA.body.data._id);

    // B pide el cliente de A → ACCESO DENEGADO vía 404 (no filtra su existencia).
    const cross = await api
      .get(`/api/v1/customers/${customerA}`)
      .set('Authorization', `Bearer ${tokenB}`);
    assertError(cross, 404, 'NOT_FOUND');

    // El listado de B sólo contiene clientes de B.
    const listB = await api.get('/api/v1/customers').set('Authorization', `Bearer ${tokenB}`);
    assertOk(listB, 200);
    assert.equal(listB.body.data.pagination.total, 1);
    assert.ok(
      listB.body.data.items.every((c) => c.companyId === idB),
      'el listado de B contenía clientes de otra empresa'
    );
    assert.ok(!listB.body.data.items.some((c) => String(c._id) === customerA));

    // El listado de A sólo contiene clientes de A.
    const listA = await api.get('/api/v1/customers').set('Authorization', `Bearer ${tokenA}`);
    assertOk(listA, 200);
    assert.ok(listA.body.data.items.some((c) => String(c._id) === customerA));
    assert.ok(!listA.body.data.items.some((c) => String(c._id) === customerB));
  });

  it('B → PATCH /companies/<idA> → 404 (y la empresa A queda intacta)', async () => {
    const res = await api
      .patch(`/api/v1/companies/${fx.companyId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Empresa Hackeada' });

    assertError(res, 404, 'NOT_FOUND');

    // A sigue con su nombre original.
    const meA = await api.get('/api/v1/companies').set('Authorization', `Bearer ${tokenA}`);
    assertOk(meA, 200);
    assert.equal(meA.body.data.name, 'Empresa Alfa');
  });

  it('B → GET /dashboard → 200 con kpi.totalCustomers=1 (sólo los suyos)', async () => {
    const res = await api.get('/api/v1/dashboard').set('Authorization', `Bearer ${tokenB}`);

    assertOk(res, 200);
    assert.equal(res.body.data.kpi.totalCustomers, 1);
    assert.equal(res.body.data.kpi.totalProducts, 0);
    assert.equal(res.body.data.kpi.salesMonth, 0);
  });
});
