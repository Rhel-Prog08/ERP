'use strict';

/**
 * tests/owner-protection.test.js — Pruebas de unidad de los guards del
 * propietario (ownerUserId) en users/service.js, sin MongoDB.
 *
 * Cada prueba instala interceptores de require() con modelos mockeados,
 * limpia la caché de require, carga el servicio y ejecuta la función real.
 */

const Module = require('module');
const path = require('path');
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const originalLoad = Module._load;

/* Variables de entorno requeridas por config/env (fail-fast si faltan). */
process.env.MONGO_URI = 'mongodb://localhost:27017/test';
process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-key-at-least-32-char';
process.env.NODE_ENV = 'test';

/* ------------------------------------------------------------------ *
 * Helper de carga con interceptores                                  *
 * ------------------------------------------------------------------ */

/**
 * Instala interceptores que resuelven la ruta completa de cada require()
 * y devuelven mocks por patrón. Limpia la caché y carga el servicio.
 */
function loadServiceWithMocks({ userFindOne, userExists, companyFindOne, roleFindOne }) {
  const targetUserDoc = userFindOne ? userFindOne() : null;
  const companyDoc = companyFindOne ? companyFindOne() : null;
  const roleDoc = roleFindOne ? roleFindOne() : null;

  // Cadena encadenable tipo Mongoose Query: findOne().select().lean() / await
  function chainable(result) {
    const chain = {
      select: () => chain,
      session: () => chain,
      lean: () => result,
      then: (resolve) => resolve(result),
    };
    return chain;
  }

  const mockUser = {
    findOne: () => chainable(targetUserDoc),
    exists: userExists || (async () => null),
  };
  const mockCompany = {
    findOne: () => chainable(companyDoc),
  };
  const mockRole = {
    findOne: () => chainable(roleDoc),
  };
  const mockAudit = { recordAudit: async () => {}, auditFromReq: async () => {}, requestMeta: () => {} };

  const mockMongoose = (() => {
    class MockObjectId {}
    class MockSchema {
      constructor(def) { this.def = def; }
      index() { return this; }
    }
    MockSchema.Types = { ObjectId: MockObjectId };
    return {
      Schema: MockSchema,
      model: () => ({}),
      connect: async () => {},
      connection: { on: () => {} },
    };
  })();

  Module._load = function (request, parent, isMain) {
    let resolved = request;
    if (parent && parent.path) {
      try { resolved = path.resolve(parent.path, request); } catch {}
    }
    const normalized = resolved.replace(/\\/g, '/');
    const routes = [
      ['modules/users/model', mockUser],
      ['modules/companies/model', mockCompany],
      ['modules/roles/model', mockRole],
      ['modules/audit/service', mockAudit],
      ['mongoose', mockMongoose],
      ['dotenv', { config: () => {} }],
      ['bcryptjs', { hash: async () => 'hash', compare: async () => true }],
    ];
    for (const [pattern, mod] of routes) {
      if (normalized.includes(pattern)) return mod;
    }
    return originalLoad.apply(this, arguments);
  };

  const keys = Object.keys(require.cache).filter((k) =>
    k.replace(/\\/g, '/').includes('modules/users/service') ||
    k.replace(/\\/g, '/').includes('modules/users/model') ||
    k.replace(/\\/g, '/').includes('modules/companies/model') ||
    k.replace(/\\/g, '/').includes('modules/roles/model') ||
    k.replace(/\\/g, '/').includes('modules/audit/service') ||
    k.replace(/\\/g, '/').includes('config/env') ||
    k.replace(/\\/g, '/').includes('config/db')
  );
  for (const k of keys) delete require.cache[k];

  const svc = require('../src/modules/users/service');

  Module._load = originalLoad;
  return svc;
}

/* ------------------------------------------------------------------ *
 * Fixtures                                                           *
 * ------------------------------------------------------------------ */

const OWNER_ID = '507f1f77bcf86cd799439011';
const ADMIN_ID = '507f1f77bcf86cd799439022';
const COMPANY_ID = '507f1f77bcf86cd799439033';
const ROLE_ID = '507f1f77bcf86cd799439044';
const OTHER_ROLE_ID = '507f1f77bcf86cd799439055';

function ownerActor() {
  return {
    id: OWNER_ID,
    email: 'owner@empresa.test',
    firstName: 'Dueño',
    lastName: 'Empresa',
    companyId: COMPANY_ID,
    role: { id: ROLE_ID, name: 'Administrador', permissions: ['users.update', 'users.delete'] },
  };
}

function adminActor() {
  return {
    id: ADMIN_ID,
    email: 'admin@empresa.test',
    firstName: 'Admin',
    lastName: 'Ajeno',
    companyId: COMPANY_ID,
    role: { id: OTHER_ROLE_ID, name: 'Administrador', permissions: ['users.update', 'users.delete'] },
  };
}

function targetUser(overrides = {}) {
  return {
    _id: OWNER_ID,
    id: OWNER_ID,
    email: 'owner@empresa.test',
    firstName: 'Dueño',
    lastName: 'Empresa',
    roleId: ROLE_ID,
    companyId: COMPANY_ID,
    status: 'active',
    refreshTokens: [{ tokenHash: 'abc', expiresAt: new Date() }],
    password: 'hashed',
    save: async function () { return this; },
    ...overrides,
  };
}

/* ------------------------------------------------------------------ *
 * Pruebas: service.update                                            *
 * ------------------------------------------------------------------ */

describe('OWNER PROTECTION — PATCH /users/:id (service.update)', () => {
  it('bloquea al administrador ajeno que cambie el correo del propietario', async () => {
    const target = targetUser();
    const company = { _id: COMPANY_ID, ownerUserId: OWNER_ID };
    const svc = loadServiceWithMocks({
      userFindOne: async () => target,
      userExists: async () => null,
      companyFindOne: async () => company,
      roleFindOne: async () => null,
    });

    await assert.rejects(
      svc.update(adminActor(), OWNER_ID, { email: 'cambiado@empresa.test' }, {}),
      (err) => err.code === 'CONFLICT' && /propietario/.test(err.message)
    );
    assert.equal(target.email, 'owner@empresa.test');
  });

  it('bloquea al administrador ajeno que cambie el rol del propietario', async () => {
    const target = targetUser();
    const company = { _id: COMPANY_ID, ownerUserId: OWNER_ID };
    const newRole = { _id: OTHER_ROLE_ID, companyId: COMPANY_ID, permissions: [], status: 'active', name: 'Otro' };
    const svc = loadServiceWithMocks({
      userFindOne: async () => target,
      userExists: async () => null,
      companyFindOne: async () => company,
      roleFindOne: async () => newRole,
    });

    await assert.rejects(
      svc.update(adminActor(), OWNER_ID, { roleId: OTHER_ROLE_ID }, {}),
      (err) => err.code === 'CONFLICT' && /propietario/.test(err.message)
    );
  });

  it('bloquea al administrador ajeno que cambie el estado del propietario', async () => {
    const target = targetUser();
    const company = { _id: COMPANY_ID, ownerUserId: OWNER_ID };
    const svc = loadServiceWithMocks({
      userFindOne: async () => target,
      userExists: async () => null,
      companyFindOne: async () => company,
      roleFindOne: async () => null,
    });

    await assert.rejects(
      svc.update(adminActor(), OWNER_ID, { status: 'inactive' }, {}),
      (err) => err.code === 'CONFLICT' && /propietario/.test(err.message)
    );
  });

  it('bloquea al administrador ajeno que resetee la contraseña del propietario', async () => {
    const target = targetUser();
    const company = { _id: COMPANY_ID, ownerUserId: OWNER_ID };
    const svc = loadServiceWithMocks({
      userFindOne: async () => target,
      userExists: async () => null,
      companyFindOne: async () => company,
      roleFindOne: async () => null,
    });

    await assert.rejects(
      svc.update(adminActor(), OWNER_ID, { newPassword: 'NuevaPass123' }, {}),
      (err) => err.code === 'CONFLICT' && /propietario/.test(err.message)
    );
  });

  it('permite al propietario cambiar su propio correo y contraseña (self)', async () => {
    const target = targetUser();
    const company = { _id: COMPANY_ID, ownerUserId: OWNER_ID };
    const svc = loadServiceWithMocks({
      userFindOne: async () => target,
      userExists: async () => null,
      companyFindOne: async () => company,
      roleFindOne: async () => null,
    });

    const result = await svc.update(ownerActor(), OWNER_ID, {
      email: 'nuevo@empresa.test',
      newPassword: 'NuevaPass123',
    }, {});

    assert.equal(result.email, 'nuevo@empresa.test');
    assert.equal(result.password, 'NuevaPass123');
    assert.deepEqual(result.refreshTokens, []);
  });

  it('permite al administrador editar campos no sensibles de un usuario no propietario', async () => {
    const target = targetUser({ _id: 'otro-id', id: 'otro-id', email: 'usuario@empresa.test', roleId: ROLE_ID });
    const company = { _id: COMPANY_ID, ownerUserId: OWNER_ID };
    const svc = loadServiceWithMocks({
      userFindOne: async () => target,
      userExists: async () => null,
      companyFindOne: async () => company,
      roleFindOne: async () => null,
    });

    const result = await svc.update(adminActor(), 'otro-id', { firstName: 'Nombre cambiado' }, {});
    assert.equal(result.firstName, 'Nombre cambiado');
  });

  it('empresa legacy sin ownerUserId (null) no bloquea cambios del administrador', async () => {
    const target = targetUser();
    const svc = loadServiceWithMocks({
      userFindOne: async () => target,
      userExists: async () => null,
      companyFindOne: async () => null, // sin empresa encontrada → ownerId = null
      roleFindOne: async () => null,
    });

    const result = await svc.update(adminActor(), OWNER_ID, { status: 'inactive' }, {});
    assert.equal(result.status, 'inactive');
  });

  it('empresa legacy sin campo ownerUserId (ausente) no bloquea cambios', async () => {
    const target = targetUser();
    const svc = loadServiceWithMocks({
      userFindOne: async () => target,
      userExists: async () => null,
      companyFindOne: async () => { _id: COMPANY_ID }, // sin ownerUserId → ownerId = null
      roleFindOne: async () => null,
    });

    const result = await svc.update(adminActor(), OWNER_ID, { status: 'inactive' }, {});
    assert.equal(result.status, 'inactive');
  });
});

/* ------------------------------------------------------------------ *
 * Pruebas: service.deactivate                                        *
 * ------------------------------------------------------------------ */

describe('OWNER PROTECTION — DELETE /users/:id (service.deactivate)', () => {
  it('bloquea al administrador ajeno que desactive al propietario', async () => {
    const target = targetUser();
    const company = { _id: COMPANY_ID, ownerUserId: OWNER_ID };
    const svc = loadServiceWithMocks({
      userFindOne: async () => target,
      companyFindOne: async () => company,
    });

    await assert.rejects(
      svc.deactivate(adminActor(), OWNER_ID, {}),
      (err) => err.code === 'CONFLICT' && /propietario/.test(err.message)
    );
    assert.equal(target.status, 'active');
  });

  it('permite al administrador desactivar a un usuario no propietario', async () => {
    const target = targetUser({ _id: 'otro-id', id: 'otro-id', email: 'usuario@empresa.test' });
    const company = { _id: COMPANY_ID, ownerUserId: OWNER_ID };
    const svc = loadServiceWithMocks({
      userFindOne: async () => target,
      companyFindOne: async () => company,
    });

    const result = await svc.deactivate(adminActor(), 'otro-id', {});
    assert.equal(result.status, 'inactive');
    assert.deepEqual(result.refreshTokens, []);
  });

  it('empresa legacy sin owner permite desactivar a cualquier usuario', async () => {
    const target = targetUser();
    const company = { _id: COMPANY_ID, ownerUserId: null };
    const svc = loadServiceWithMocks({
      userFindOne: async () => target,
      companyFindOne: async () => company,
    });

    const result = await svc.deactivate(adminActor(), OWNER_ID, {});
    assert.equal(result.status, 'inactive');
  });
});
