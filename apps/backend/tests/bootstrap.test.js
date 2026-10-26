'use strict';

/**
 * tests/bootstrap.test.js — SUITE DEL BOOTSTRAP SEGURO DE PRODUCCIÓN
 *
 * Qué verifica:
 *  1. seed de desarrollo RECHAZADO con NODE_ENV=production (exit ≠ 0);
 *  2. bootstrap sin BOOTSTRAP_CONFIRM → rechazado y SIN cambios en la BD;
 *  3. bootstrap sin BOOTSTRAP_ADMIN_PASSWORD → rechazado, listando sólo
 *     el NOMBRE de la variable (nunca valores);
 *  4. bootstrap con contraseña débil → rechazado por la política existente
 *     del backend (utils/password);
 *  5. bootstrap válido → crea permisos, empresa, sucursal, almacén,
 *     settings, roles y administrador (bcrypt), SIN datos de negocio;
 *  5b. (compatibilidad auth) login + GET /auth/me + POST /auth/refresh con
 *     el usuario creado por el bootstrap;
 *  6. segunda ejecución → NO duplica ningún registro (idempotente);
 *  6b. email existente PERTENECIENTE al administrador correcto → válido,
 *      sin duplicar usuario y SIN tocar la contraseña;
 *  6c. mismo email en OTRA empresa → el bootstrap falla y el usuario
 *      existente queda intacto (empresa, rol, estado y contraseña);
 *  6d. mismo email con OTRO rol → el bootstrap falla y el usuario intacto;
 *  6e. mismo email INACTIVO → el bootstrap falla y sigue inactivo;
 *  7. NI las contraseñas NI los secretos aparecen en los logs de ninguna
 *      ejecución.
 *
 * Cada ejecución del script corre en UN PROCESO HIJO contra la base de
 * pruebas (erp_test heredada de tests/run.js): jamás toca la base de
 * producción y no requiere (ni imprime) secretos reales.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const request = require('supertest');

const app = require('../src/app');
const { setup, teardown, assertOk } = require('./helpers');
const { PERMISSION_LIST, DEFAULT_ROLES, ROLE_PERMISSIONS } = require('../src/config/constants');

const Permission = require('../src/modules/permissions/model');
const Company = require('../src/modules/companies/model');
const Branch = require('../src/modules/branches/model');
const Warehouse = require('../src/modules/warehouses/model');
const Settings = require('../src/modules/settings/model');
const Role = require('../src/modules/roles/model');
const User = require('../src/modules/users/model');
const Product = require('../src/modules/products/model');
const Customer = require('../src/modules/customers/model');
const Supplier = require('../src/modules/suppliers/model');
const Sale = require('../src/modules/sales/model');
const Purchase = require('../src/modules/purchases/model');

const api = request(app);
const BACKEND_ROOT = path.join(__dirname, '..');
const BOOTSTRAP = path.join(BACKEND_ROOT, 'src', 'database', 'bootstrap.js');
const SEED = path.join(BACKEND_ROOT, 'src', 'database', 'seed.js');

// Datos LOCALES de prueba — nunca credenciales reales ni de producción.
const ADMIN_EMAIL = 'boot-admin@bootstrap.test.local';
const ADMIN_PASSWORD = 'BootstrapClave123!';
const WEAK_PASSWORD = '99999999'; // cumple largo pero SIN letra → política la rechaza
const COMPANY_NAME = 'Empresa Bootstrap Test';
const BRANCH_NAME = 'Sucursal Bootstrap';
const WAREHOUSE_NAME = 'Almacén Bootstrap';

// Escenarios de CONFLICTO (sólo datos locales de prueba).
const CONFLICT_EMAIL_COMPANY = 'conflict-company@bootstrap.test.local';
const CONFLICT_EMAIL_ROLE = 'conflict-role@bootstrap.test.local';
const CONFLICT_EMAIL_INACTIVE = 'conflict-inactive@bootstrap.test.local';
const CONFLICT_PASSWORD = 'ConflictoClave123';

/** Secretos que JAMÁS deben aparecer en la salida de ningún script. */
const SECRETS_NEVER_IN_LOGS = [ADMIN_PASSWORD, WEAK_PASSWORD, CONFLICT_PASSWORD];

/** Salidas de TODAS las ejecuciones (las revisa el test 7). */
const capturedLogs = [];

/** Ejecuta un script de src/database en proceso hijo contra erp_test. */
function runNode(script, envOverrides = {}) {
  const res = spawnSync(process.execPath, [script], {
    cwd: BACKEND_ROOT,
    encoding: 'utf8',
    timeout: 60000,
    env: { ...process.env, ...envOverrides },
  });
  const output = `${res.stdout || ''}${res.stderr || ''}`;
  capturedLogs.push({ script: path.basename(script), output });
  return { status: res.status, output };
}

/** Entorno completo y determinista del bootstrap (sobreescribe .env). */
function bootstrapEnv(extra = {}) {
  return {
    BOOTSTRAP_CONFIRM: 'CODEEVO_INITIAL_SETUP',
    BOOTSTRAP_ADMIN_EMAIL: ADMIN_EMAIL,
    BOOTSTRAP_ADMIN_PASSWORD: ADMIN_PASSWORD,
    BOOTSTRAP_ADMIN_FIRST_NAME: 'Boot',
    BOOTSTRAP_ADMIN_LAST_NAME: 'Admin',
    BOOTSTRAP_COMPANY_NAME: COMPANY_NAME,
    BOOTSTRAP_BRANCH_NAME: BRANCH_NAME,
    BOOTSTRAP_WAREHOUSE_NAME: WAREHOUSE_NAME,
    ...extra,
  };
}

describe('BOOTSTRAP — inicialización segura, idempotente y sin secretos', () => {
  before(async () => {
    await setup();
  });
  after(teardown);

  it('1. seed de desarrollo rechazado con NODE_ENV=production (exit ≠ 0)', () => {
    const r = runNode(SEED, {
      NODE_ENV: 'production',
      // Secretos de PRUEBA que superan los requisitos de env.js en producción
      // (nunca llegan a usarse: el guard corta ANTES de conectar).
      JWT_SECRET: 'jwt_falso_para_pruebas_000000000000000000',
      REFRESH_TOKEN_SECRET: 'refresh_falso_para_pruebas_111111111111111',
      // env.js exige URLs HTTPS en producción ANTES de cualquier otro guard
      // (los enlaces de verificación deben ser HTTPS): se satisfase para que
      // el mensaje que este test verifica —el guard del seed— sea el que se imprima.
      CLIENT_URL: 'https://localhost.test',
      APP_URL: 'https://localhost.test',
    });

    assert.notEqual(r.status, 0, `el seed en producción debía fallar. Salida:\n${r.output}`);
    assert.match(r.output, /no puede ejecutarse en producción/);
    assert.ok(!r.output.includes(ADMIN_PASSWORD), 'nunca debe imprimirse una contraseña');
  });

  it('2. bootstrap sin BOOTSTRAP_CONFIRM → rechazado y sin cambios en la BD', async () => {
    const r = runNode(BOOTSTRAP, { ...bootstrapEnv(), BOOTSTRAP_CONFIRM: '' });

    assert.notEqual(r.status, 0, `debía ser rechazado. Salida:\n${r.output}`);
    assert.match(r.output, /Bootstrap cancelado: falta confirmación explícita/);
    assert.equal(await User.countDocuments({ email: ADMIN_EMAIL }), 0, 'no debía crear usuarios');
    assert.equal(await Company.countDocuments({ name: COMPANY_NAME }), 0, 'no debía crear empresas');
  });

  it('3. bootstrap sin BOOTSTRAP_ADMIN_PASSWORD → rechazado (sólo nombres de variable)', () => {
    const r = runNode(BOOTSTRAP, { ...bootstrapEnv(), BOOTSTRAP_ADMIN_PASSWORD: '' });

    assert.notEqual(r.status, 0, `debía ser rechazado. Salida:\n${r.output}`);
    assert.match(r.output, /faltan variables obligatorias/);
    assert.match(r.output, /BOOTSTRAP_ADMIN_PASSWORD/, 'debe nombrar la variable que falta');
    assert.ok(!r.output.includes(ADMIN_EMAIL), 'no debe filtrar los valores de las demás variables');
  });

  it('4. bootstrap con contraseña débil → rechazado por la política del backend', () => {
    const r = runNode(BOOTSTRAP, { ...bootstrapEnv(), BOOTSTRAP_ADMIN_PASSWORD: WEAK_PASSWORD });

    assert.notEqual(r.status, 0, `debía ser rechazado. Salida:\n${r.output}`);
    assert.match(r.output, /BOOTSTRAP_ADMIN_PASSWORD no cumple la política/);
    assert.ok(!r.output.includes(WEAK_PASSWORD), 'la contraseña débil no debe aparecer en los logs');
  });

  it('5. bootstrap válido → crea la estructura inicial SIN datos de negocio', () => {
    const r = runNode(BOOTSTRAP, bootstrapEnv());

    assert.equal(r.status, 0, `bootstrap debía completarse. Salida:\n${r.output}`);
    assert.match(r.output, /\[bootstrap\] Empresa lista/);
    assert.match(r.output, /\[bootstrap\] Roles listos/);
    assert.match(r.output, /\[bootstrap\] Usuario administrador listo/);
    assert.match(r.output, /\[bootstrap\] Inicialización completada/);
    assert.ok(!r.output.includes(ADMIN_PASSWORD), 'la contraseña nunca debe imprimirse');
  });

  it('5b. la estructura creada es completa y el admin es compatible con el flujo de auth', async () => {
    // Catálogo global de permisos, sin duplicar los de los fixtures.
    assert.equal(await Permission.countDocuments(), PERMISSION_LIST.length);

    // Cadena del tenant inicial.
    const company = await Company.findOne({ name: COMPANY_NAME });
    assert.ok(company, 'la empresa debía existir');
    const branch = await Branch.findOne({ companyId: company._id, name: BRANCH_NAME });
    assert.ok(branch, 'la sucursal debía existir');
    const warehouse = await Warehouse.findOne({ companyId: company._id, name: WAREHOUSE_NAME });
    assert.ok(warehouse, 'el almacén debía existir');
    const settings = await Settings.findOne({ companyId: company._id });
    assert.ok(settings, 'settings por defecto debía existir');
    assert.equal(settings.taxRate, 0.21);

    // Los 6 roles por defecto con sus permisos exactos.
    const roles = await Role.find({ companyId: company._id });
    assert.equal(roles.length, DEFAULT_ROLES.length, 'debían crearse los 6 roles');
    const adminRole = roles.find((role) => role.name === 'Administrador');
    assert.ok(adminRole, 'el rol Administrador debía existir');
    assert.deepEqual(
      new Set(adminRole.permissions),
      new Set(ROLE_PERMISSIONS.Administrador),
      'Administrador debe tener TODOS los permisos'
    );

    // Administrador: contraseña con bcrypt (nunca en texto plano).
    const admin = await User.findOne({ email: ADMIN_EMAIL }).select('+password');
    assert.ok(admin, 'el administrador debía existir');
    assert.equal(admin.status, 'active');
    assert.equal(String(admin.companyId), String(company._id));
    assert.equal(String(admin.roleId), String(adminRole._id));
    assert.match(admin.password, /^\$2[aby]\$/, 'la contraseña debe estar hasheada con bcrypt');
    assert.ok(!admin.password.includes(ADMIN_PASSWORD), 'no debe guardarse en texto plano');

    // FASE 4: cero datos de negocio ficticios.
    assert.equal(await Product.countDocuments({ companyId: company._id }), 0);
    assert.equal(await Customer.countDocuments({ companyId: company._id }), 0);
    assert.equal(await Supplier.countDocuments({ companyId: company._id }), 0);
    assert.equal(await Sale.countDocuments({ companyId: company._id }), 0);
    assert.equal(await Purchase.countDocuments({ companyId: company._id }), 0);

    // No elimina información existente (los fixtures siguen intactos).
    assert.ok(await Company.findOne({ name: 'Empresa Alfa' }), 'los datos previos no deben borrarse');

    // FASE 6: login → /auth/me → refresh con el usuario del bootstrap.
    const loginRes = await api.post('/api/v1/auth/login').send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    assertOk(loginRes, 200);
    const { user, accessToken, refreshToken, expiresIn } = loginRes.body.data;
    assert.equal(user.email, ADMIN_EMAIL);
    assert.equal(user.company.name, COMPANY_NAME);
    assert.equal(user.role.name, 'Administrador');
    assert.ok(Array.isArray(user.role.permissions));
    assert.equal(typeof expiresIn, 'number');

    const me = await api.get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);
    assertOk(me, 200);
    assert.equal(me.body.data.email, ADMIN_EMAIL);
    assert.equal(me.body.data.company.name, COMPANY_NAME);

    const refreshRes = await api.post('/api/v1/auth/refresh').send({ refreshToken });
    assertOk(refreshRes, 200);
    assert.ok(refreshRes.body.data.accessToken, 'el refresh debía emitir un nuevo access token');
  });

  it('6. segunda ejecución → no duplica registros (idempotente)', async () => {
    const snapshot = async () => ({
      permissions: await Permission.countDocuments(),
      companies: await Company.countDocuments(),
      branches: await Branch.countDocuments(),
      warehouses: await Warehouse.countDocuments(),
      settings: await Settings.countDocuments(),
      roles: await Role.countDocuments(),
      users: await User.countDocuments(),
    });

    const before = await snapshot();
    const r = runNode(BOOTSTRAP, bootstrapEnv());

    assert.equal(r.status, 0, `la segunda ejecución debía completarse. Salida:\n${r.output}`);
    assert.match(r.output, /ya existente/, 'debe informar que reutiliza lo existente');
    assert.deepEqual(await snapshot(), before, 'la segunda ejecución no debe duplicar ni modificar registros');
  });

  it('6b. email existente del administrador CORRECTO → lo reutiliza sin duplicar ni tocar nada', async () => {
    const before = await User.findOne({ email: ADMIN_EMAIL }).select('+password');
    assert.ok(before, 'el administrador debía existir de los tests previos');
    const usersBefore = await User.countDocuments();

    const r = runNode(BOOTSTRAP, bootstrapEnv());

    assert.equal(r.status, 0, `debía completarse. Salida:\n${r.output}`);
    assert.match(r.output, /Usuario administrador ya existente/);
    assert.equal(await User.countDocuments(), usersBefore, 'no debe duplicar usuarios');

    const after = await User.findOne({ email: ADMIN_EMAIL }).select('+password');
    assert.equal(String(after.companyId), String(before.companyId), 'no debe reasignar empresa');
    assert.equal(String(after.roleId), String(before.roleId), 'no debe reasignar rol');
    assert.equal(after.status, before.status, 'no debe cambiar el estado');
    assert.equal(after.password, before.password, 'no debe modificar la contraseña');
  });

  it('6c. mismo email en OTRA empresa → falla y el usuario original queda intacto', async () => {
    // Usuario con el MISMO email de bootstrap pero en la empresa de fixtures.
    const alfa = await Company.findOne({ name: 'Empresa Alfa' });
    const alfaRole = await Role.findOne({ companyId: alfa._id, name: 'Administrador' });
    await User.create({
      firstName: 'Otra',
      lastName: 'Empresa',
      email: CONFLICT_EMAIL_COMPANY,
      password: CONFLICT_PASSWORD,
      roleId: alfaRole._id,
      companyId: alfa._id,
      status: 'active',
    });
    const before = await User.findOne({ email: CONFLICT_EMAIL_COMPANY }).select('+password');
    const usersBefore = await User.countDocuments();

    const r = runNode(BOOTSTRAP, bootstrapEnv({ BOOTSTRAP_ADMIN_EMAIL: CONFLICT_EMAIL_COMPANY }));

    assert.notEqual(r.status, 0, `debía abortar. Salida:\n${r.output}`);
    assert.match(r.output, /ya existe pero no corresponde al administrador esperado/);
    assert.match(r.output, /no pertenece a la empresa del bootstrap/);

    const after = await User.findOne({ email: CONFLICT_EMAIL_COMPANY }).select('+password');
    assert.equal(await User.countDocuments(), usersBefore, 'no debe crear ni eliminar usuarios');
    assert.equal(String(after.companyId), String(before.companyId), 'no debe reasignar empresa');
    assert.equal(String(after.roleId), String(before.roleId), 'no debe reasignar rol');
    assert.equal(after.status, 'active', 'no debe cambiar el estado');
    assert.equal(after.password, before.password, 'no debe modificar la contraseña');
  });

  it('6d. mismo email con OTRO rol (misma empresa) → falla y el usuario queda intacto', async () => {
    // Mismo email y empresa del bootstrap pero con rol "Consulta".
    const company = await Company.findOne({ name: COMPANY_NAME });
    const consultRole = await Role.findOne({ companyId: company._id, name: 'Consulta' });
    await User.create({
      firstName: 'Otro',
      lastName: 'Rol',
      email: CONFLICT_EMAIL_ROLE,
      password: CONFLICT_PASSWORD,
      roleId: consultRole._id,
      companyId: company._id,
      status: 'active',
    });
    const before = await User.findOne({ email: CONFLICT_EMAIL_ROLE }).select('+password');
    const usersBefore = await User.countDocuments();

    const r = runNode(BOOTSTRAP, bootstrapEnv({ BOOTSTRAP_ADMIN_EMAIL: CONFLICT_EMAIL_ROLE }));

    assert.notEqual(r.status, 0, `debía abortar. Salida:\n${r.output}`);
    assert.match(r.output, /no tiene el rol Administrador de esta empresa/);
    assert.ok(!r.output.includes('no pertenece a la empresa'), 'la empresa SÍ coincide: no debe reportarse');
    assert.ok(!r.output.includes('no está activo'), 'el estado SÍ es active: no debe reportarse');

    const after = await User.findOne({ email: CONFLICT_EMAIL_ROLE }).select('+password');
    assert.equal(await User.countDocuments(), usersBefore, 'no debe crear ni eliminar usuarios');
    assert.equal(String(after.companyId), String(before.companyId), 'no debe reasignar empresa');
    assert.equal(String(after.roleId), String(before.roleId), 'no debe reasignar rol');
    assert.equal(after.status, 'active', 'no debe cambiar el estado');
    assert.equal(after.password, before.password, 'no debe modificar la contraseña');
  });

  it('6e. mismo email INACTIVO → falla y el usuario sigue inactivo', async () => {
    // Email y empresa correctos, rol Administrador correcto, pero INACTIVO.
    const company = await Company.findOne({ name: COMPANY_NAME });
    const adminRole = await Role.findOne({ companyId: company._id, name: 'Administrador' });
    await User.create({
      firstName: 'Inac',
      lastName: 'Tivo',
      email: CONFLICT_EMAIL_INACTIVE,
      password: CONFLICT_PASSWORD,
      roleId: adminRole._id,
      companyId: company._id,
      status: 'inactive',
    });
    const before = await User.findOne({ email: CONFLICT_EMAIL_INACTIVE }).select('+password');
    const usersBefore = await User.countDocuments();

    const r = runNode(BOOTSTRAP, bootstrapEnv({ BOOTSTRAP_ADMIN_EMAIL: CONFLICT_EMAIL_INACTIVE }));

    assert.notEqual(r.status, 0, `debía abortar. Salida:\n${r.output}`);
    assert.match(r.output, /el usuario no está activo/);
    assert.ok(!r.output.includes('no pertenece a la empresa'), 'la empresa SÍ coincide: no debe reportarse');
    assert.ok(!r.output.includes('no tiene el rol Administrador'), 'el rol SÍ coincide: no debe reportarse');

    const after = await User.findOne({ email: CONFLICT_EMAIL_INACTIVE }).select('+password');
    assert.equal(await User.countDocuments(), usersBefore, 'no debe crear ni eliminar usuarios');
    assert.equal(after.status, 'inactive', 'no debe activar ni modificar el usuario');
    assert.equal(String(after.companyId), String(before.companyId), 'no debe reasignar empresa');
    assert.equal(String(after.roleId), String(before.roleId), 'no debe reasignar rol');
    assert.equal(after.password, before.password, 'no debe modificar la contraseña');
  });

  it('7. ni contraseñas ni secretos aparecen en los logs de ninguna ejecución', () => {
    assert.ok(capturedLogs.length >= 6, `esperaban-se ≥6 ejecuciones capturadas, hubo ${capturedLogs.length}`);
    for (const entry of capturedLogs) {
      for (const secret of SECRETS_NEVER_IN_LOGS) {
        assert.ok(
          !entry.output.includes(secret),
          `un secreto de prueba apareció en la salida de ${entry.script}`
        );
      }
      if (process.env.JWT_SECRET) {
        assert.ok(!entry.output.includes(process.env.JWT_SECRET), 'JWT_SECRET apareció en logs');
      }
      if (process.env.REFRESH_TOKEN_SECRET) {
        assert.ok(!entry.output.includes(process.env.REFRESH_TOKEN_SECRET), 'REFRESH_TOKEN_SECRET apareció en logs');
      }
    }
  });
});
