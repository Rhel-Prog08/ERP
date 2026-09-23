'use strict';

/**
 * tests/helpers.js — utilidades compartidas por TODA la suite integrada.
 *
 * - setup():    conecta a erp_test (replica set rs0), limpia por completo la
 *               base (dropDatabase), RECREA los índices únicos declarados en
 *               los esquemas (dropDatabase los elimina y tests como el de SKU
 *               duplicado dependen del índice real para producir el E11000 →
 *               409) y fabrica los fixtures de la "Empresa Alfa":
 *               catálogo global de permisos, sucursal, almacén, settings,
 *               los 6 roles por defecto (desde ROLE_PERMISSIONS) y 3 usuarios
 *               (Administrador, Consulta y Ventas).
 * - login():    POST /api/v1/auth/login → devuelve el accessToken.
 * - loginRaw(): igual pero devuelve el data completo (accessToken+refreshToken).
 * - teardown(): desconecta mongoose.
 * - assertOk()/assertError(): afirman SIEMPRE el sobre {success:true} o el
 *               sobre de error {success:false, error:{code:'...'}}.
 *
 * Cada archivo de pruebas ejecuta before(setup) / after(teardown). Como los
 * archivos corren SERIALIZADOS (--test-concurrency=1), cada uno parte de una
 * base limpia y aislada de los demás.
 */

const mongoose = require('mongoose');
const assert = require('node:assert/strict');

const { connectDB } = require('../src/config/db');
const {
  PERMISSION_LIST,
  DEFAULT_ROLES,
  ROLE_PERMISSIONS,
  SETTINGS_DEFAULTS,
} = require('../src/config/constants');

const Permission = require('../src/modules/permissions/model');
const Company = require('../src/modules/companies/model');
const Branch = require('../src/modules/branches/model');
const Warehouse = require('../src/modules/warehouses/model');
const Settings = require('../src/modules/settings/model');
const Role = require('../src/modules/roles/model');
const User = require('../src/modules/users/model');
const Category = require('../src/modules/categories/model');
const Product = require('../src/modules/products/model');
const Customer = require('../src/modules/customers/model');
const Supplier = require('../src/modules/suppliers/model');
const Sale = require('../src/modules/sales/model');
const Purchase = require('../src/modules/purchases/model');
const { StockBalance, StockMovement } = require('../src/modules/inventory/model');
const AuditLog = require('../src/modules/audit/model');
const Notification = require('../src/modules/notifications/model');
const { Sequence } = require('../src/database/sequence');

/** Todos los modelos con índices declarados (se recreen tras dropDatabase). */
const MODELS = [
  Permission, Company, Branch, Warehouse, Settings, Role, User,
  Category, Product, Customer, Supplier, Sale, Purchase,
  StockBalance, StockMovement, AuditLog, Notification, Sequence,
];

const ADMIN_EMAIL = 'admin-alfa@test.local';
const ADMIN_PASSWORD = 'Admin12345!';
const CONSULTA_EMAIL = 'consulta@test.local';
const CONSULTA_PASSWORD = 'Consulta12345!';
const VENTAS_EMAIL = 'ventas@test.local';
const VENTAS_PASSWORD = 'Ventas12345!';

/**
 * Prepara una base de pruebas limpia con fixtures y devuelve los ids.
 * Usa connectDB (envuelve mongoose.connect + detección de replica set) para
 * que withTransaction() opere con transacciones REALES, igual que en
 * producción: así la atomicidad que se predica en las pruebas es la real.
 */
async function setup() {
  await connectDB(process.env.MONGO_URI);

  await mongoose.connection.db.dropDatabase();

  // dropDatabase borró colecciones E índices: recreamos los declarados
  // (unicidad de SKU+empresa, email, secuencias…) ANTES de los fixtures.
  await Promise.all(MODELS.map((m) => m.createIndexes()));

  // Catálogo global de permisos (misma fuente que el seed de producción).
  await Permission.bulkWrite(
    PERMISSION_LIST.map((p) => ({
      updateOne: { filter: { key: p.key }, update: { $set: p }, upsert: true },
    }))
  );

  const company = await Company.create({
    name: 'Empresa Alfa',
    legalName: 'Empresa Alfa S.L.',
    taxId: 'A-11111111',
    email: 'alfa@test.local',
    status: 'active',
  });

  const branch = await Branch.create({
    name: 'Sucursal Central',
    address: 'Calle Mayor 1',
    companyId: company._id,
  });

  const warehouse = await Warehouse.create({
    name: 'Almacén Central',
    branchId: branch._id,
    companyId: company._id,
  });

  const settings = await Settings.create({
    companyId: company._id,
    ...SETTINGS_DEFAULTS,
  });

  const roles = {};
  for (const name of DEFAULT_ROLES) {
    roles[name] = await Role.create({
      name,
      companyId: company._id,
      permissions: ROLE_PERMISSIONS[name],
      isSystem: true,
      status: 'active',
    });
  }

  const admin = await User.create({
    firstName: 'Admin',
    lastName: 'Alfa',
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    roleId: roles.Administrador._id,
    companyId: company._id,
  });

  const consulta = await User.create({
    firstName: 'Consulta',
    lastName: 'Alfa',
    email: CONSULTA_EMAIL,
    password: CONSULTA_PASSWORD,
    roleId: roles.Consulta._id,
    companyId: company._id,
  });

  const ventas = await User.create({
    firstName: 'Ventas',
    lastName: 'Alfa',
    email: VENTAS_EMAIL,
    password: VENTAS_PASSWORD,
    roleId: roles.Ventas._id,
    companyId: company._id,
  });

  return {
    company,
    branch,
    warehouse,
    settings,
    roles,
    companyId: String(company._id),
    branchId: String(branch._id),
    warehouseId: String(warehouse._id),
    admin: { id: String(admin._id), email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    consulta: { id: String(consulta._id), email: CONSULTA_EMAIL, password: CONSULTA_PASSWORD },
    ventas: { id: String(ventas._id), email: VENTAS_EMAIL, password: VENTAS_PASSWORD },
  };
}

/** POST /auth/login → devuelve sólo el accessToken (falla con detalle si no). */
async function login(request, email, password) {
  const data = await loginRaw(request, email, password);
  if (!data || !data.accessToken) {
    throw new Error(`login(${email}) no devolvió accessToken: ${JSON.stringify(data)}`);
  }
  return data.accessToken;
}

/** POST /auth/login → devuelve el data completo {user, accessToken, ...}. */
async function loginRaw(request, email, password) {
  const res = await request.post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`login(${email}) falló → ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

/** Desconexión limpia al terminar cada archivo de pruebas. */
async function teardown() {
  await mongoose.disconnect();
}

/** Afirma una respuesta de éxito: estado esperado + sobre {success:true}. */
function assertOk(res, status = 200) {
  assert.equal(
    res.status,
    status,
    `esperaba ${status}, llegó ${res.status}: ${JSON.stringify(res.body)}`
  );
  assert.equal(
    res.body.success,
    true,
    `esperaba sobre {success:true}: ${JSON.stringify(res.body)}`
  );
}

/** Afirma una respuesta de error: estado + {success:false, error:{code}}. */
function assertError(res, status, code) {
  assert.equal(
    res.status,
    status,
    `esperaba ${status}, llegó ${res.status}: ${JSON.stringify(res.body)}`
  );
  assert.equal(
    res.body.success,
    false,
    `esperaba sobre {success:false}: ${JSON.stringify(res.body)}`
  );
  assert.equal(
    res.body.error && res.body.error.code,
    code,
    `esperaba error.code=${code}: ${JSON.stringify(res.body)}`
  );
}

module.exports = {
  setup,
  teardown,
  login,
  loginRaw,
  assertOk,
  assertError,
  MODELS,
};
