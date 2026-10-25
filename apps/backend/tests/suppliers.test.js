'use strict';

/**
 * tests/suppliers.test.js — SUITE DEDICADA DE PROVEEDORES (FASE E, ETAPA 1)
 *
 * Espejo de customers.test.js adaptado a /api/v1/suppliers:
 *  - POST/GET/PATCH/DELETE (desactivación lógica);
 *  - validación MX en API (teléfono 10 dígitos, correo y nombre obligatorios);
 *  - respuestas HTTP correctas ante entradas inválidas;
 *  - RBAC (Administrador, Consulta lectura, Ventas SIN permiso, Compras con
 *    permiso completo de proveedores);
 *  - aislamiento multiempresa;
 *  - conservación de contactos históricos inválidos al editar otros campos;
 *  - paginación, filtros, búsqueda y auditoría.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const api = request(app);
const { setup, teardown, login, assertOk, assertError } = require('./helpers');
const Supplier = require('../src/modules/suppliers/model');
const Company = require('../src/modules/companies/model');
const Role = require('../src/modules/roles/model');
const User = require('../src/modules/users/model');
const AuditLog = require('../src/modules/audit/model');
const { ROLE_PERMISSIONS } = require('../src/config/constants');

const API = '/api/v1/suppliers';

/** Documento legacy insertado SIN validadores de mongoose (dato migrado). */
async function insertLegacySupplier(companyId) {
  const res = await Supplier.collection.insertOne({
    supplierCode: 'PR-99998',
    name: 'Proveedor Histórico',
    email: 'sin-arroba-ejemplo',
    phone: '55',
    status: 'active',
    companyId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return String(res.insertedId);
}

/** Empresa Beta con su propio Administrador (aislamiento multiempresa). */
async function makeBetaAdmin() {
  const beta = await Company.create({
    name: 'Empresa Beta',
    legalName: 'Empresa Beta S.L.',
    taxId: 'B-22222222',
    email: 'beta@test.local',
    status: 'active',
  });
  const role = await Role.create({
    name: 'Administrador',
    companyId: beta._id,
    permissions: ROLE_PERMISSIONS.Administrador,
    isSystem: true,
    status: 'active',
  });
  await User.create({
    firstName: 'Admin',
    lastName: 'Beta',
    email: 'admin-beta@test.local',
    password: 'Admin12345!',
    roleId: role._id,
    companyId: beta._id,
  });
  const token = await login(api, 'admin-beta@test.local', 'Admin12345!');
  return { companyId: String(beta._id), token };
}

describe('PROVEEDORES — API dedicada (FASE E)', () => {
  let fx;
  let adminToken;
  let consultaToken;
  let ventasToken;
  let comprasToken;
  let beta;
  let legacyId;
  let createdId;

  before(async () => {
    fx = await setup();
    adminToken = await login(api, fx.admin.email, fx.admin.password);
    consultaToken = await login(api, fx.consulta.email, fx.consulta.password);
    ventasToken = await login(api, fx.ventas.email, fx.ventas.password);

    // Usuario del rol Compras (tiene suppliers.read/create/update/delete).
    await User.create({
      firstName: 'Compras',
      lastName: 'Alfa',
      email: 'compras@test.local',
      password: 'Compras12345!',
      roleId: fx.roles.Compras._id,
      companyId: fx.company._id,
    });
    comprasToken = await login(api, 'compras@test.local', 'Compras12345!');

    legacyId = await insertLegacySupplier(fx.company._id);
    beta = await makeBetaAdmin();
  });

  after(teardown);

  /* ------------------------------ POST ---------------------------------- */

  it('POST — alta válida: 201, código PR-#####, companyId del token y auditoría', async () => {
    const res = await api
      .post(API)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Proveedor Nuevo',
        companyName: 'Importaciones MX',
        email: 'NUEVO.Prov@Ejemplo.MX',
        phone: '5598761234',
        address: 'Parque Industrial 5',
      });
    assertOk(res, 201);
    assert.match(res.body.data.supplierCode, /^PR-\d{5}$/);
    assert.equal(String(res.body.data.companyId), fx.companyId);
    assert.equal(res.body.data.status, 'active');
    assert.equal(res.body.data.email, 'nuevo.prov@ejemplo.mx'); // normalizado
    createdId = String(res.body.data._id);

    const audit = await AuditLog.findOne({ action: 'CREATE_SUPPLIER', entityId: createdId });
    assert.ok(audit, 'debía registrarse la auditoría CREATE_SUPPLIER');
  });

  it('POST — nombre, correo y teléfono obligatorios → 400 VALIDATION_ERROR con campo', async () => {
    const base = { name: 'Proveedor Base', email: 'base@prov.mx', phone: '5598761234' };
    for (const campo of ['name', 'email', 'phone']) {
      const body = { ...base };
      delete body[campo];
      const res = await api.post(API).set('Authorization', `Bearer ${adminToken}`).send(body);
      assertError(res, 400, 'VALIDATION_ERROR');
      assert.equal(
        res.body.error.details && res.body.error.details[0] && res.body.error.details[0].field,
        campo,
        `el error debía señalar el campo ${campo}: ${JSON.stringify(res.body.error)}`
      );
    }
  });

  it('POST — teléfono MX: 9 y 11 dígitos, letras y tipo numérico → 400', async () => {
    const invalidos = ['559876123', '55987612345', '55A87612B4', 5598761234];
    for (const phone of invalidos) {
      const res = await api
        .post(API)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Proveedor Tel Malo', email: 'telmalo@prov.mx', phone });
      assertError(res, 400, 'VALIDATION_ERROR');
    }
  });

  it('POST — correo inválido y nombre de 1 carácter → 400', async () => {
    const casos = [
      { name: 'Proveedor Email', email: 'no-es-un-correo', phone: '5598761234' },
      { name: 'X', email: 'x@prov.mx', phone: '5598761234' },
    ];
    for (const body of casos) {
      const res = await api.post(API).set('Authorization', `Bearer ${adminToken}`).send(body);
      assertError(res, 400, 'VALIDATION_ERROR');
    }
  });

  /* ------------------------- GET list / paginación ----------------------- */

  it('GET — paginación, búsqueda (?q=), filtro (?status=) y orden (?sort=)', async () => {
    for (let i = 1; i <= 12; i += 1) {
      await Supplier.collection.insertOne({
        supplierCode: `PR-888${String(i).padStart(2, '0')}`,
        name: `Paginado Proveedor ${i}`,
        email: `pagprov${i}@ejemplo.com`,
        phone: '5598761234',
        status: i === 12 ? 'inactive' : 'active',
        companyId: fx.company._id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const p1 = await api.get(`${API}?limit=5&page=1`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(p1, 200);
    assert.equal(p1.body.data.items.length, 5);
    assert.ok(p1.body.data.pagination.total >= 14);

    const p2 = await api.get(`${API}?limit=5&page=2`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(p2, 200);
    const codesP1 = p1.body.data.items.map((i) => i.supplierCode);
    const codesP2 = p2.body.data.items.map((i) => i.supplierCode);
    assert.equal(codesP2.filter((c) => codesP1.includes(c)).length, 0, 'las páginas no se solapan');

    const qNombre = await api.get(`${API}?q=Paginado&limit=100`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(qNombre, 200);
    assert.equal(qNombre.body.data.pagination.total, 12);

    const qCodigo = await api.get(`${API}?q=PR-88803`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(qCodigo, 200);
    assert.equal(qCodigo.body.data.items.length, 1);

    const inactivos = await api.get(`${API}?status=inactive&limit=100`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(inactivos, 200);
    assert.ok(inactivos.body.data.items.every((i) => i.status === 'inactive'));

    const orden = await api.get(`${API}?sort=name&limit=3`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(orden, 200);
    const sortBad = await api.get(`${API}?sort=password`).set('Authorization', `Bearer ${adminToken}`);
    assertError(sortBad, 400, 'VALIDATION_ERROR');
  });

  /* ------------------------------ GET :id -------------------------------- */

  it('GET /:id — 200 propio, 404 inexistente y 404 cross-company', async () => {
    const propio = await api.get(`${API}/${createdId}`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(propio, 200);
    assert.equal(propio.body.data.name, 'Proveedor Nuevo');

    const inexistente = await api.get(`${API}/64b000000000000000000000`).set('Authorization', `Bearer ${adminToken}`);
    assertError(inexistente, 404, 'NOT_FOUND');

    const resBeta = await api
      .post(API)
      .set('Authorization', `Bearer ${beta.token}`)
      .send({ name: 'Proveedor Beta', email: 'beta.prov@ejemplo.mx', phone: '5512340987' });
    assertOk(resBeta, 201);
    const cross = await api.get(`${API}/${resBeta.body.data._id}`).set('Authorization', `Bearer ${adminToken}`);
    assertError(cross, 404, 'NOT_FOUND');
  });

  /* ------------------------------ PATCH ---------------------------------- */

  it('PATCH — editar otros campos NO sobrescribe los contactos históricos inválidos', async () => {
    const antes = await api.get(`${API}/${legacyId}`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(antes, 200);
    assert.equal(antes.body.data.phone, '55');
    assert.equal(antes.body.data.email, 'sin-arroba-ejemplo');

    const res = await api
      .patch(`${API}/${legacyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ companyName: 'Importadora Vieja SA' });
    assertOk(res, 200);

    const doc = await Supplier.findById(legacyId).lean();
    assert.equal(doc.phone, '55', 'el teléfono histórico debe conservarse intacto');
    assert.equal(doc.email, 'sin-arroba-ejemplo', 'el correo histórico debe conservarse intacto');
    assert.equal(doc.companyName, 'Importadora Vieja SA');
  });

  it('PATCH — teléfono válido actualiza; inválidos → 400 sin tocar el dato', async () => {
    const ok = await api
      .patch(`${API}/${legacyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: '5512340988' });
    assertOk(ok, 200);

    const telMalo = await api
      .patch(`${API}/${legacyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: '551234098' });
    assertError(telMalo, 400, 'VALIDATION_ERROR');

    const mailMalo = await api
      .patch(`${API}/${legacyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'no-valido' });
    assertError(mailMalo, 400, 'VALIDATION_ERROR');

    const doc = await Supplier.findById(legacyId).lean();
    assert.equal(doc.phone, '5512340988');
    assert.equal(doc.email, 'sin-arroba-ejemplo');
  });

  it('PATCH — companyId nunca cambia y cross-company responde 404', async () => {
    const spoof = await api
      .patch(`${API}/${legacyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ companyId: beta.companyId });
    assertOk(spoof, 200);
    const doc = await Supplier.findById(legacyId).lean();
    assert.equal(String(doc.companyId), fx.companyId);

    const listBeta = await api.get(`${API}?limit=100`).set('Authorization', `Bearer ${beta.token}`);
    const idBeta = listBeta.body.data.items[0]._id;
    const cross = await api
      .patch(`${API}/${idBeta}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'No Debe Verse' });
    assertError(cross, 404, 'NOT_FOUND');
  });

  /* ----------------------------- DESACTIVAR ------------------------------ */

  it('DELETE — desactivación lógica idempotente + auditoría DELETE_SUPPLIER', async () => {
    const res = await api.delete(`${API}/${createdId}`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(res, 200);
    assert.equal(res.body.data.status, 'inactive');

    const doc = await Supplier.findById(createdId).lean();
    assert.ok(doc, 'el documento NO debe borrarse físicamente');
    assert.equal(doc.status, 'inactive');

    const audit = await AuditLog.findOne({ action: 'DELETE_SUPPLIER', entityId: createdId });
    assert.ok(audit, 'debía registrarse la auditoría DELETE_SUPPLIER');

    const otraVez = await api.delete(`${API}/${createdId}`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(otraVez, 200);
  });

  /* -------------------------------- RBAC --------------------------------- */

  it('RBAC — Consulta sólo lee; Ventas SIN permiso de proveedores → 403', async () => {
    const lee = await api.get(`${API}?limit=1`).set('Authorization', `Bearer ${consultaToken}`);
    assertOk(lee, 200);

    const creaConsulta = await api
      .post(API)
      .set('Authorization', `Bearer ${consultaToken}`)
      .send({ name: 'No Puede', email: 'nopuede@prov.mx', phone: '5598761234' });
    assertError(creaConsulta, 403, 'AUTHORIZATION_ERROR');

    const creaVentas = await api
      .post(API)
      .set('Authorization', `Bearer ${ventasToken}`)
      .send({ name: 'Tampoco Ventas', email: 'ventas@prov.mx', phone: '5598761234' });
    assertError(creaVentas, 403, 'AUTHORIZATION_ERROR');

    const sinToken = await api.get(API);
    assertError(sinToken, 401, 'AUTHENTICATION_ERROR');
  });

  it('RBAC — Compras crea y desactiva proveedores (permisos completos)', async () => {
    const crea = await api
      .post(API)
      .set('Authorization', `Bearer ${comprasToken}`)
      .send({ name: 'Proveedor Compras', email: 'compras.prov@ejemplo.mx', phone: '5512340989' });
    assertOk(crea, 201);

    const borra = await api.delete(`${API}/${crea.body.data._id}`).set('Authorization', `Bearer ${comprasToken}`);
    assertOk(borra, 200);
    assert.equal(borra.body.data.status, 'inactive');
  });

  /* ----------------------------- MULTEMPRESA ----------------------------- */

  it('MULTIEMPRESA — listados aislados por empresa', async () => {
    const alpha = await api.get(`${API}?limit=100`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(alpha, 200);
    assert.ok(alpha.body.data.items.every((i) => String(i.companyId) === fx.companyId));
    assert.ok(alpha.body.data.items.every((i) => i.name !== 'Proveedor Beta'));

    const betaList = await api.get(`${API}?limit=100`).set('Authorization', `Bearer ${beta.token}`);
    assertOk(betaList, 200);
    assert.ok(betaList.body.data.items.every((i) => String(i.companyId) === beta.companyId));
  });
});
