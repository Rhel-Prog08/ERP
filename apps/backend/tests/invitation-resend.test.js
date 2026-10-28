'use strict';

/**
 * tests/invitation-resend.test.js — Pruebas de unidad del flujo de reenvío
 * de invitaciones (registration.service.resendInvitation y
 * createInvitation), sin MongoDB.
 *
 * Cubre: rotación de token, invalidación del anterior, cooldown,
 * invitaciones vencidas/usadas/revocadas, fallo de correo (no revocar),
 * concurrencia optimista (__v) y auditoría.
 */

const Module = require('module');
const path = require('path');
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const originalLoad = Module._load;

process.env.MONGO_URI = 'mongodb://localhost:27017/test';
process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-key-at-least-32-char';
process.env.NODE_ENV = 'test';

/* ------------------------------------------------------------------ *
 * Utilidades de mock encadenable (tipo Mongoose Query)               *
 * ------------------------------------------------------------------ */

function chainable(result) {
  const chain = {
    sort: () => chain,
    select: () => chain,
    session: () => chain,
    lean: () => result,
    then: (resolve) => resolve(result),
  };
  return chain;
}

function makeInvitation(overrides = {}) {
  return {
    _id: 'inv-001',
    email: 'invitado@empresa.test',
    firstName: 'Invitado',
    lastName: 'Prueba',
    roleId: 'role-001',
    companyId: 'comp-001',
    status: 'pending',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 120 * 1000),
    __v: 0,
    save: async function () { return this; },
    ...overrides,
  };
}

/* ------------------------------------------------------------------ *
 * Helper de carga con interceptores                                  *
 * ------------------------------------------------------------------ */

function loadRegistrationWithMocks(opts = {}) {
  const {
    invitationOverrides,
    invitationFindOne,
    invitationFindOneAndUpdate,
    roleData,
    userData,
    userExistsResult,
    sendInvitationMailImpl,
    generateTokenImpl,
    hashTokenImpl,
  } = opts;

  const pendingInvite = makeInvitation(invitationOverrides);

  const mockInvitation = {
    findOne: invitationFindOne || (() => chainable(pendingInvite)),
    findOneAndUpdate: invitationFindOneAndUpdate || ((filter, update, options) => {
      // Default: aplica $set y $inc a pendingInvite como haría MongoDB
      if (update.$set) Object.assign(pendingInvite, update.$set);
      if (update.$inc && update.$inc.__v) pendingInvite.__v += update.$inc.__v;
      return { then: (resolve) => resolve(pendingInvite) };
    }),
    create: async (data) => ({ ...data, status: 'pending', save: async function () { return this; } }),
  };

  const mockRole = {
    findOne: () => chainable(roleData || null),
  };
  const mockUser = {
    findOne: () => chainable(userData || null),
    exists: async () => userExistsResult || null,
  };

  let lastSendInvitationMailArgs = null;
  let sendInvitationMailShouldThrow = false;
  const mockMailer = {
    sendInvitationMail: async (args) => {
      lastSendInvitationMailArgs = args;
      if (sendInvitationMailShouldThrow) throw new Error('Proveedor de correo caído');
      return { provider: 'test' };
    },
  };
  if (sendInvitationMailImpl) mockMailer.sendInvitationMail = sendInvitationMailImpl;

  let lastAudit = null;
  const mockAudit = {
    recordAudit: async (entry) => { lastAudit = entry; },
    requestMeta: () => ({}),
  };

  let lastGeneratedToken = null;
  const mockTokens = {
    generateToken: generateTokenImpl || (() => { lastGeneratedToken = 'token-abc'; return 'token-abc'; }),
    hashToken: hashTokenImpl || ((t) => 'hash-of-' + t),
  };

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
      ['modules/registration/model', mockInvitation],
      ['modules/roles/model', mockRole],
      ['modules/users/model', mockUser],
      ['modules/audit/service', mockAudit],
      ['utils/mailer', mockMailer],
      ['utils/tokens', mockTokens],
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
    k.replace(/\\/g, '/').includes('modules/registration/service') ||
    k.replace(/\\/g, '/').includes('modules/registration/model') ||
    k.replace(/\\/g, '/').includes('modules/roles/model') ||
    k.replace(/\\/g, '/').includes('modules/users/model') ||
    k.replace(/\\/g, '/').includes('modules/audit/service') ||
    k.replace(/\\/g, '/').includes('utils/mailer') ||
    k.replace(/\\/g, '/').includes('utils/tokens') ||
    k.replace(/\\/g, '/').includes('config/env') ||
    k.replace(/\\/g, '/').includes('config/db')
  );
  for (const k of keys) delete require.cache[k];

  const svc = require('../src/modules/registration/service');

  Module._load = originalLoad;

  return {
    svc,
    get lastSendInvitationMailArgs() { return lastSendInvitationMailArgs; },
    get lastAudit() { return lastAudit; },
    get lastGeneratedToken() { return lastGeneratedToken; },
    setSendInvitationMailShouldThrow(v) { sendInvitationMailShouldThrow = v; },
    get pendingInvite() { return pendingInvite; },
  };
}

const actor = {
  id: 'user-001', companyId: 'comp-001',
  firstName: 'Admin', lastName: 'Test',
  role: { id: 'role-001', name: 'Admin', permissions: ['users.create'] },
};

/* ------------------------------------------------------------------ *
 * Pruebas: resendInvitation — Caso A (invitación pendiente)          *
 * ------------------------------------------------------------------ */

describe('RESEND INVITATION — invitación pendiente', () => {
  it('rota el token y devuelve la invitación actualizada', async () => {
    const { svc, pendingInvite } = loadRegistrationWithMocks();

    const result = await svc.resendInvitation(actor, { email: 'invitado@empresa.test' }, {});

    assert.equal(result.status, 'pending');
    assert.equal(result.tokenHash, 'hash-of-token-abc');
    assert.ok(result.expiresAt >= pendingInvite.expiresAt);
  });

  it('invalidación del token anterior: el hash cambia en cada reenvío', async () => {
    const { svc, pendingInvite } = loadRegistrationWithMocks();

    const hashBefore = pendingInvite.tokenHash;
    await svc.resendInvitation(actor, { email: 'invitado@empresa.test' }, {});
    assert.notEqual(pendingInvite.tokenHash, hashBefore);
  });

  it('aplica cooldown si la invitación no está vencida', async () => {
    const { svc } = loadRegistrationWithMocks({
      invitationOverrides: {
        updatedAt: new Date(Date.now() - 10 * 1000), // hace 10s (dentro de cooldown de 60s)
      },
    });

    await assert.rejects(
      svc.resendInvitation(actor, { email: 'invitado@empresa.test' }, {}),
      (err) => err.code === 'CONFLICT' && /esperar/.test(err.message)
    );
  });

  it('invitación vencida salta el cooldown y se reenvía inmediatamente', async () => {
    const { svc } = loadRegistrationWithMocks({
      invitationOverrides: {
        expiresAt: new Date(Date.now() - 1000), // vencida hace 1s
        updatedAt: new Date(Date.now() - 10 * 1000), // hace 10s (dentro de cooldown, pero está vencida)
      },
    });

    const result = await svc.resendInvitation(actor, { email: 'invitado@empresa.test' }, {});
    assert.equal(result.status, 'pending');
  });

  it('concurrencia: dos reenvíos simultáneos → el segundo recibe ConflictError (__v)', async () => {
    let callCount = 0;
    const { svc } = loadRegistrationWithMocks({
      invitationFindOneAndUpdate: (filter, update) => {
        callCount++;
        if (callCount === 1) {
          return { then: (resolve) => resolve({ _id: 'inv-001', status: 'pending', __v: 1, tokenHash: 'hash-of-token-abc', expiresAt: new Date() }) };
        }
        return null; // segundo: __v no coincide
      },
    });

    const p1 = svc.resendInvitation(actor, { email: 'invitado@empresa.test' }, {});
    const p2 = svc.resendInvitation(actor, { email: 'invitado@empresa.test' }, {});

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].reason.code, 'CONFLICT');
  });

  it('fallo de correo: lanza MailError, NO revoca la invitación', async () => {
    const { svc, pendingInvite, setSendInvitationMailShouldThrow } = loadRegistrationWithMocks();

    setSendInvitationMailShouldThrow(true);

    await assert.rejects(
      svc.resendInvitation(actor, { email: 'invitado@empresa.test' }, {}),
      (err) => err.code === 'MAIL_ERROR'
    );

    // La invitación debe seguir siendo 'pending' (no revocada)
    assert.equal(pendingInvite.status, 'pending');
    // El token debe haberse rotado (hash cambió)
    assert.equal(pendingInvite.tokenHash, 'hash-of-token-abc');
  });

  it('registra auditoría con acción RESEND_INVITATION', async () => {
    let auditAction = null;
    const Module = require('module');
    const originalLoad2 = Module._load;

    const mockInvitation = { findOne: () => chainable(makeInvitation()), findOneAndUpdate: (f, u) => { if (u.$set) Object.assign(makeInvitation(), u.$set); return { then: (r) => r(makeInvitation()) }; }, create: async () => ({}) };
    const mockRole = { findOne: () => chainable(null) };
    const mockUser = { findOne: () => chainable(null), exists: async () => null };
    const mockMailer = { sendInvitationMail: async () => ({ provider: 'test' }) };
    const mockAudit = {
      recordAudit: async (entry) => { auditAction = entry.action; },
      requestMeta: () => ({}),
    };
    const mockTokens = { generateToken: () => 'token-abc', hashToken: (t) => 'hash-of-' + t };

    const mockMongoose = (() => {
      class MockObjectId {}
      class MockSchema {
        constructor(def) { this.def = def; }
        index() { return this; }
      }
      MockSchema.Types = { ObjectId: MockObjectId };
      return { Schema: MockSchema, model: () => ({}), connect: async () => {}, connection: { on: () => {} } };
    })();

    Module._load = function (request, parent, isMain) {
      let resolved = request;
      if (parent && parent.path) {
        try { resolved = path.resolve(parent.path, request); } catch {}
      }
      const normalized = resolved.replace(/\\/g, '/');
      const routes = [
        ['modules/registration/model', mockInvitation],
        ['modules/roles/model', mockRole],
        ['modules/users/model', mockUser],
        ['modules/audit/service', mockAudit],
        ['utils/mailer', mockMailer],
        ['utils/tokens', mockTokens],
        ['mongoose', mockMongoose],
        ['dotenv', { config: () => {} }],
        ['bcryptjs', { hash: async () => 'hash', compare: async () => true }],
      ];
      for (const [pattern, mod] of routes) {
        if (normalized.includes(pattern)) return mod;
      }
      return originalLoad2.apply(this, arguments);
    };

    const keys = Object.keys(require.cache).filter((k) =>
      k.replace(/\\/g, '/').includes('modules/registration/service')
    );
    for (const k of keys) delete require.cache[k];
    const svc = require('../src/modules/registration/service');
    Module._load = originalLoad2;

    await svc.resendInvitation(actor, { email: 'invitado@empresa.test' }, {});

    assert.equal(auditAction, 'RESEND_INVITATION');
  });
});

/* ------------------------------------------------------------------ *
 * Pruebas: resendInvitation — Casos B y C                            *
 * ------------------------------------------------------------------ */

describe('RESEND INVITATION — sin invitación pendiente', () => {
  it('sin invitación pendiente y sin roleId → NotFoundError (404)', async () => {
    const { svc } = loadRegistrationWithMocks({
      invitationFindOne: () => chainable(null),
    });

    await assert.rejects(
      svc.resendInvitation(actor, { email: 'usado@empresa.test' }, {}),
      (err) => err.code === 'NOT_FOUND'
    );
  });

  it('invitación usada o revocada con roleId → crea nueva invitación', async () => {
    const { svc } = loadRegistrationWithMocks({
      invitationFindOne: () => chainable(null),
      roleData: { _id: 'role-001', companyId: 'comp-001', permissions: [], status: 'active', name: 'Rol' },
      userData: null,
      userExistsResult: null,
    });

    const result = await svc.resendInvitation(actor, {
      email: 'nuevo@empresa.test',
      firstName: 'Nuevo',
      lastName: 'Usuario',
      roleId: 'role-001',
    }, {});

    assert.equal(result.status, 'pending');
    assert.equal(result.email, 'nuevo@empresa.test');
  });

  it('invitación usada con roleId pero sin nombre/apellidos → ValidationError', async () => {
    const { svc } = loadRegistrationWithMocks({
      invitationFindOne: () => chainable(null),
    });

    await assert.rejects(
      svc.resendInvitation(actor, { email: 'x@empresa.test', roleId: 'role-001' }, {}),
      (err) => err.code === 'VALIDATION_ERROR'
    );
  });
});

/* ------------------------------------------------------------------ *
 * Pruebas: createInvitation — fallo de correo no revoca              *
 * ------------------------------------------------------------------ */

describe('CREATE INVITATION — fallo de correo', () => {
  it('fallo de correo: lanza MailError, NO revoca la invitación', async () => {
    const createdInvite = { status: 'pending', save: async function () { return this; } };
    const Module = require('module');
    const originalLoad2 = Module._load;

    const mockInvitation = {
      findOne: () => chainable(null),
      create: async () => createdInvite,
    };
    const mockRole = { findOne: () => chainable({ _id: 'role-001', companyId: 'comp-001', permissions: [], status: 'active', name: 'Rol' }) };
    const mockUser = { findOne: () => chainable(null), exists: async () => null };
    const mockMailer = {
      sendInvitationMail: async () => { throw new Error('Proveedor caído'); },
    };
    const mockAudit = { recordAudit: async () => {}, requestMeta: () => ({}) };
    const mockTokens = { generateToken: () => 'token-abc', hashToken: (t) => 'hash-of-' + t };

    const mockMongoose = (() => {
      class MockObjectId {}
      class MockSchema {
        constructor(def) { this.def = def; }
        index() { return this; }
      }
      MockSchema.Types = { ObjectId: MockObjectId };
      return { Schema: MockSchema, model: () => ({}), connect: async () => {}, connection: { on: () => {} } };
    })();

    Module._load = function (request, parent, isMain) {
      let resolved = request;
      if (parent && parent.path) {
        try { resolved = path.resolve(parent.path, request); } catch {}
      }
      const normalized = resolved.replace(/\\/g, '/');
      const routes = [
        ['modules/registration/model', mockInvitation],
        ['modules/roles/model', mockRole],
        ['modules/users/model', mockUser],
        ['modules/audit/service', mockAudit],
        ['utils/mailer', mockMailer],
        ['utils/tokens', mockTokens],
        ['mongoose', mockMongoose],
        ['dotenv', { config: () => {} }],
        ['bcryptjs', { hash: async () => 'hash', compare: async () => true }],
      ];
      for (const [pattern, mod] of routes) {
        if (normalized.includes(pattern)) return mod;
      }
      return originalLoad2.apply(this, arguments);
    };

    const keys = Object.keys(require.cache).filter((k) =>
      k.replace(/\\/g, '/').includes('modules/registration/service')
    );
    for (const k of keys) delete require.cache[k];
    const svc = require('../src/modules/registration/service');
    Module._load = originalLoad2;

    await assert.rejects(
      svc.createInvitation(actor, {
        email: 'nuevo@empresa.test',
        firstName: 'Nuevo',
        lastName: 'Usuario',
        roleId: 'role-001',
      }, {}),
      (err) => err.code === 'MAIL_ERROR'
    );
  });
});
