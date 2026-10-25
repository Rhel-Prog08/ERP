'use strict';

/**
 * tests/customers.test.js — SUITE DEDICADA DE CLIENTES (FASE E, ETAPA 1)
 *
 * Cubre:
 *  - POST/GET/PATCH/DELETE (desactivación lógica) de /api/v1/customers;
 *  - validación MX en API: teléfono String de exactamente 10 dígitos,
 *    correo y nombre obligatorios, límites de longitud;
 *  - respuestas HTTP correctas ante entradas inválidas (400 VALIDATION_ERROR,
 *    404 NOT_FOUND, 403 AUTHORIZATION_ERROR, 401 AUTHENTICATION_ERROR);
 *  - RBAC por rol (Administrador, Consulta, Ventas) y sin token;
 *  - aislamiento multiempresa (creación de una segunda empresa en fixtures);
 *  - conservación de contactos históricos inválidos al editar otros campos
 *    (documentos legacy insertados SIN pasar por los validadores, como una
 *    migración real);
 *  - paginación, filtros (?status=), búsqueda (?q=) y orden (?sort=);
 *  - auditoría CREATE_CUSTOMER / DELETE_CUSTOMER.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const api = request(app);
const { setup, teardown, login, assertOk, assertError } = require('./helpers');
const Customer = require('../src/modules/customers/model');
const Company = require('../src/modules/companies/model');
const Role = require('../src/modules/roles/model');
const User = require('../src/modules/users/model');
const AuditLog = require('../src/modules/audit/model');
const { ROLE_PERMISSIONS } = require('../src/config/constants');

const API = '/api/v1/customers';

/** Documento legacy insertado SIN validadores de mongoose (dato migrado). */
async function insertLegacyCustomer(companyId) {
  const res = await Customer.collection.insertOne({
    customerCode: 'CL-99998',
    name: 'Cliente Histórico',
    email: 'legacy@correo',
    phone: '12345',
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

describe('CLIENTES — API dedicada (FASE E)', () => {
  let fx;
  let adminToken;
  let consultaToken;
  let ventasToken;
  let beta;
  let legacyId;
  let createdId;

  before(async () => {
    fx = await setup();
    adminToken = await login(api, fx.admin.email, fx.admin.password);
    consultaToken = await login(api, fx.consulta.email, fx.consulta.password);
    ventasToken = await login(api, fx.ventas.email, fx.ventas.password);
    legacyId = await insertLegacyCustomer(fx.company._id);
    beta = await makeBetaAdmin();
  });

  after(teardown);

  /* ------------------------------ POST ---------------------------------- */

  it('POST — alta válida: 201, código CL-#####, companyId del token y auditoría', async () => {
    const res = await api
      .post(API)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Cliente Nuevo',
        companyName: 'Comercial MX SA',
        email: 'NUEVO@Ejemplo.MX',
        phone: '5512345678',
        address: 'Av. Juárez 10, CDMX',
      });
    assertOk(res, 201);
    assert.match(res.body.data.customerCode, /^CL-\d{5}$/);
    assert.equal(String(res.body.data.companyId), fx.companyId);
    assert.equal(res.body.data.status, 'active');
    assert.equal(res.body.data.email, 'nuevo@ejemplo.mx'); // normalizado
    createdId = String(res.body.data._id);

    const audit = await AuditLog.findOne({ action: 'CREATE_CUSTOMER', entityId: createdId });
    assert.ok(audit, 'debía registrarse la auditoría CREATE_CUSTOMER');
  });

  it('POST — nombre, correo y teléfono obligatorios → 400 VALIDATION_ERROR con campo', async () => {
    const base = { name: 'Cliente Base', email: 'base@ejemplo.mx', phone: '5512345678' };
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
    const invalidos = ['551234567', '55123456789', '5512A4567B', 5512345678];
    for (const phone of invalidos) {
      const res = await api
        .post(API)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Cliente Tel Malo', email: 'telmalo@ejemplo.mx', phone });
      assertError(res, 400, 'VALIDATION_ERROR');
    }
  });

  it('POST — correo inválido, nombre de 1 carácter y nombre de 121 → 400', async () => {
    const casos = [
      { name: 'Cliente Email', email: 'no-es-un-correo', phone: '5512345678' },
      { name: 'X', email: 'x@ejemplo.mx', phone: '5512345678' },
      { name: 'x'.repeat(121), email: 'largo@ejemplo.mx', phone: '5512345678' },
    ];
    for (const body of casos) {
      const res = await api.post(API).set('Authorization', `Bearer ${adminToken}`).send(body);
      assertError(res, 400, 'VALIDATION_ERROR');
    }
  });

  it('POST — el companyId del cliente nunca se acepta (siempre el del token)', async () => {
    const res = await api
      .post(API)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Cliente Spoof',
        email: 'spoof@ejemplo.mx',
        phone: '5512345678',
        companyId: beta.companyId,
      });
    assertOk(res, 201);
    assert.equal(String(res.body.data.companyId), fx.companyId, 'companyId debe ser el del token');
  });

  /* ------------------------- GET list / paginación ----------------------- */

  it('GET — paginación, búsqueda (?q=), filtro (?status=) y orden (?sort=)', async () => {
    for (let i = 1; i <= 12; i += 1) {
      await Customer.collection.insertOne({
        customerCode: `CL-888${String(i).padStart(2, '0')}`,
        name: `Paginado Cliente ${i}`,
        email: `pag${i}@ejemplo.com`,
        phone: '5512345678',
        status: i === 12 ? 'inactive' : 'active',
        companyId: fx.company._id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Página 1 y 2 con límite 5, sin solapamiento.
    const p1 = await api.get(`${API}?limit=5&page=1`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(p1, 200);
    assert.equal(p1.body.data.items.length, 5);
    assert.equal(p1.body.data.pagination.limit, 5);
    assert.ok(p1.body.data.pagination.total >= 14, 'total ≥ 14 (legacy + creados + paginados)');

    const p2 = await api.get(`${API}?limit=5&page=2`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(p2, 200);
    const codesP1 = p1.body.data.items.map((i) => i.customerCode);
    const codesP2 = p2.body.data.items.map((i) => i.customerCode);
    assert.equal(codesP2.filter((c) => codesP1.includes(c)).length, 0, 'las páginas no se solapan');

    // Búsqueda por nombre y por código.
    const qNombre = await api.get(`${API}?q=Paginado&limit=100`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(qNombre, 200);
    assert.equal(qNombre.body.data.pagination.total, 12);
    const qCodigo = await api.get(`${API}?q=CL-88803`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(qCodigo, 200);
    assert.equal(qCodigo.body.data.items.length, 1);
    assert.equal(qCodigo.body.data.items[0].customerCode, 'CL-88803');

    // Filtro por estado.
    const inactivos = await api.get(`${API}?status=inactive&limit=100`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(inactivos, 200);
    assert.ok(inactivos.body.data.items.every((i) => i.status === 'inactive'));
    assert.ok(inactivos.body.data.items.some((i) => i.customerCode === 'CL-88812'));

    // Orden permitido y orden no permitido (whitelist → 400).
    const orden = await api.get(`${API}?sort=name&limit=3`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(orden, 200);
    const sortBad = await api.get(`${API}?sort=password`).set('Authorization', `Bearer ${adminToken}`);
    assertError(sortBad, 400, 'VALIDATION_ERROR');
  });

  /* ------------------------------ GET :id -------------------------------- */

  it('GET /:id — 200 propio, 404 inexistente y 404 cross-company', async () => {
    const propio = await api.get(`${API}/${createdId}`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(propio, 200);
    assert.equal(propio.body.data.name, 'Cliente Nuevo');

    const inexistente = await api.get(`${API}/64b000000000000000000000`).set('Authorization', `Bearer ${adminToken}`);
    assertError(inexistente, 404, 'NOT_FOUND');

    const resBeta = await api
      .post(API)
      .set('Authorization', `Bearer ${beta.token}`)
      .send({ name: 'Cliente Beta', email: 'beta.cliente@ejemplo.mx', phone: '5598765432' });
    assertOk(resBeta, 201);
    const cross = await api.get(`${API}/${resBeta.body.data._id}`).set('Authorization', `Bearer ${adminToken}`);
    assertError(cross, 404, 'NOT_FOUND');
  });

  /* ------------------------------ PATCH ---------------------------------- */

  it('PATCH — editar otros campos NO sobrescribe los contactos históricos inválidos', async () => {
    const antes = await api.get(`${API}/${legacyId}`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(antes, 200);
    assert.equal(antes.body.data.phone, '12345', 'el legacy debe cargar su teléfono histórico');
    assert.equal(antes.body.data.email, 'legacy@correo');

    const res = await api
      .patch(`${API}/${legacyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ companyName: 'Empresa Histórica SA', address: 'Calle Antigua 1' });
    assertOk(res, 200);
    assert.equal(res.body.data.companyName, 'Empresa Histórica SA');

    const doc = await Customer.findById(legacyId).lean();
    assert.equal(doc.phone, '12345', 'el teléfono histórico debe conservarse intacto');
    assert.equal(doc.email, 'legacy@correo', 'el correo histórico debe conservarse intacto');
    assert.equal(doc.address, 'Calle Antigua 1');
  });

  it('PATCH — teléfono válido actualiza; teléfono/correo inválidos → 400 sin tocar el dato', async () => {
    const ok = await api
      .patch(`${API}/${legacyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: '5598765432' });
    assertOk(ok, 200);
    assert.equal(ok.body.data.phone, '5598765432');

    const telMalo = await api
      .patch(`${API}/${legacyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: '5598' });
    assertError(telMalo, 400, 'VALIDATION_ERROR');

    const mailMalo = await api
      .patch(`${API}/${legacyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'tampoco-es-email' });
    assertError(mailMalo, 400, 'VALIDATION_ERROR');

    const doc = await Customer.findById(legacyId).lean();
    assert.equal(doc.phone, '5598765432', 'tras el 400 el teléfono debe seguir siendo el válido');
    assert.equal(doc.email, 'legacy@correo');
  });

  it('PATCH — companyId nunca cambia y cross-company responde 404', async () => {
    const spoof = await api
      .patch(`${API}/${legacyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ companyId: beta.companyId, name: 'Cliente Histórico Renombrado' });
    assertOk(spoof, 200);
    const doc = await Customer.findById(legacyId).lean();
    assert.equal(String(doc.companyId), fx.companyId, 'companyId debe permanecer el del token');
    assert.equal(doc.name, 'Cliente Histórico Renombrado');

    const listBeta = await api.get(`${API}?limit=100`).set('Authorization', `Bearer ${beta.token}`);
    assertOk(listBeta, 200);
    const idBeta = listBeta.body.data.items[0]._id;
    const cross = await api
      .patch(`${API}/${idBeta}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'No Debe Verse' });
    assertError(cross, 404, 'NOT_FOUND');
  });

  /* ----------------------------- DESACTIVAR ------------------------------ */

  it('DELETE — desactivación lógica idempotente + auditoría DELETE_CUSTOMER', async () => {
    const res = await api.delete(`${API}/${createdId}`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(res, 200);
    assert.equal(res.body.data.status, 'inactive');

    const doc = await Customer.findById(createdId).lean();
    assert.ok(doc, 'el documento NO debe borrarse físicamente');
    assert.equal(doc.status, 'inactive');

    const audit = await AuditLog.findOne({ action: 'DELETE_CUSTOMER', entityId: createdId });
    assert.ok(audit, 'debía registrarse la auditoría DELETE_CUSTOMER');

    // Idempotente: desactivar de nuevo responde 200 sin error.
    const otraVez = await api.delete(`${API}/${createdId}`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(otraVez, 200);
    assert.equal(otraVez.body.data.status, 'inactive');
  });

  /* -------------------------------- RBAC --------------------------------- */

  it('RBAC — Consulta sólo lee (POST/PATCH/DELETE → 403) y sin token → 401', async () => {
    const lee = await api.get(`${API}?limit=1`).set('Authorization', `Bearer ${consultaToken}`);
    assertOk(lee, 200);

    const crea = await api
      .post(API)
      .set('Authorization', `Bearer ${consultaToken}`)
      .send({ name: 'No Puede', email: 'nopuede@ejemplo.mx', phone: '5512345678' });
    assertError(crea, 403, 'AUTHORIZATION_ERROR');

    const edita = await api
      .patch(`${API}/${legacyId}`)
      .set('Authorization', `Bearer ${consultaToken}`)
      .send({ name: 'Tampoco' });
    assertError(edita, 403, 'AUTHORIZATION_ERROR');

    const borra = await api.delete(`${API}/${legacyId}`).set('Authorization', `Bearer ${consultaToken}`);
    assertError(borra, 403, 'AUTHORIZATION_ERROR');

    const sinToken = await api.get(API);
    assertError(sinToken, 401, 'AUTHENTICATION_ERROR');
  });

  it('RBAC — Ventas crea clientes pero NO puede desactivar (sin customers.delete)', async () => {
    const crea = await api
      .post(API)
      .set('Authorization', `Bearer ${ventasToken}`)
      .send({ name: 'Cliente Ventas', email: 'ventas.cliente@ejemplo.mx', phone: '5512345670' });
    assertOk(crea, 201);

    const borra = await api.delete(`${API}/${crea.body.data._id}`).set('Authorization', `Bearer ${ventasToken}`);
    assertError(borra, 403, 'AUTHORIZATION_ERROR');
  });

  /* ----------------------------- MULTEMPRESA ----------------------------- */

  it('MULTIEMPRESA — listados aislados y 404 hacia documentos de otra empresa', async () => {
    const alpha = await api.get(`${API}?limit=100`).set('Authorization', `Bearer ${adminToken}`);
    assertOk(alpha, 200);
    assert.ok(
      alpha.body.data.items.every((i) => String(i.companyId) === fx.companyId),
      'el listado de Alfa no debe incluir documentos de otra empresa'
    );
    assert.ok(alpha.body.data.items.every((i) => i.name !== 'Cliente Beta'));

    const betaList = await api.get(`${API}?limit=100`).set('Authorization', `Bearer ${beta.token}`);
    assertOk(betaList, 200);
    assert.ok(betaList.body.data.items.every((i) => String(i.companyId) === beta.companyId));
  });
});
