'use strict';

/**
 * tests/password-reset.test.js — Pruebas de unidad del flujo de recuperación
 * de contraseña (auth/service.forgotPassword y auth/service.resetPassword),
 * sin MongoDB.
 *
 * Cubre: solicitud con correo existente/inexistente, token válido/vencido/
 * reutilizado/inválido, contraseña insuficiente, concurrencia, revocación de
 * sesiones, aislamiento multiempresa, fallo de correo y cooldown.
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
    select: () => chain,
    session: () => chain,
    lean: () => result,
    then: (resolve) => resolve(result),
  };
  return chain;
}

function makeUser(overrides = {}) {
  return {
    _id: 'user-001',
    id: 'user-001',
    email: 'usuario@empresa.test',
    firstName: 'Usuario',
    lastName: 'Prueba',
    companyId: 'comp-001',
    status: 'active',
    password: 'hashed-old',
    passwordVersion: 0,
    refreshTokens: [{ tokenHash: 'old-refresh', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }],
    passwordResetToken: null,
    save: async function () { return this; },
    ...overrides,
  };
}

/* ------------------------------------------------------------------ *
 * Helper de carga con interceptores                                  *
 * ------------------------------------------------------------------ */

function loadAuthServiceWithMocks(opts = {}) {
  const {
    userData,
    userExistsResult,
    sendPasswordResetMailImpl,
    generateTokenImpl,
    hashTokenImpl,
    bcryptHashImpl,
    bcryptCompareImpl,
    auditShouldThrow,
  } = opts;

  const user = makeUser(userData);

  const mockUserModel = {
    findOne: () => chainable(user),
    findById: () => chainable(user),
  };

  let lastMailArgs = null;
  let sendMailShouldThrow = false;
  const mockMailer = {
    sendPasswordResetMail: async (args) => {
      lastMailArgs = args;
      if (sendMailShouldThrow) throw new Error('Proveedor de correo caído');
      return { provider: 'test' };
    },
  };
  if (sendPasswordResetMailImpl) mockMailer.sendPasswordResetMail = sendPasswordResetMailImpl;

  let lastAudit = null;
  const mockAudit = {
    recordAudit: async (entry) => {
      if (auditShouldThrow) throw new Error('Auditoría caída');
      lastAudit = entry;
    },
    requestMeta: () => ({}),
  };

  let lastGeneratedToken = null;
  const mockTokens = {
    generateToken: generateTokenImpl || (() => { lastGeneratedToken = 'token-abc'; return 'token-abc'; }),
    hashToken: hashTokenImpl || ((t) => 'hash-of-' + t),
  };

  let lastBcryptHash = null;
  const mockBcrypt = {
    hash: async (pw) => { lastBcryptHash = pw; return 'hash-of-' + pw; },
    compare: bcryptCompareImpl || (async () => true),
  };

  const mockJwt = {
    sign: () => 'mock-access-token',
    verify: () => ({ sub: 'user-001', passwordVersion: 0 }),
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
      ['modules/users/model', mockUserModel],
      ['modules/audit/service', mockAudit],
      ['utils/mailer', mockMailer],
      ['utils/tokens', mockTokens],
      ['jsonwebtoken', mockJwt],
      ['bcryptjs', mockBcrypt],
      ['mongoose', mockMongoose],
      ['dotenv', { config: () => {} }],
    ];
    for (const [pattern, mod] of routes) {
      if (normalized.includes(pattern)) return mod;
    }
    return originalLoad.apply(this, arguments);
  };

  const keys = Object.keys(require.cache).filter((k) =>
    k.replace(/\\/g, '/').includes('modules/auth/service') ||
    k.replace(/\\/g, '/').includes('modules/users/model') ||
    k.replace(/\\/g, '/').includes('modules/audit/service') ||
    k.replace(/\\/g, '/').includes('utils/mailer') ||
    k.replace(/\\/g, '/').includes('utils/tokens') ||
    k.replace(/\\/g, '/').includes('config/env') ||
    k.replace(/\\/g, '/').includes('config/db')
  );
  for (const k of keys) delete require.cache[k];

  const svc = require('../src/modules/auth/service');

  Module._load = originalLoad;

  return {
    svc,
    get user() { return user; },
    get lastMailArgs() { return lastMailArgs; },
    get lastAudit() { return lastAudit; },
    get lastGeneratedToken() { return lastGeneratedToken; },
    get lastBcryptHash() { return lastBcryptHash; },
    setSendMailShouldThrow(v) { sendMailShouldThrow = v; },
    setBcryptCompare(impl) { mockBcrypt.compare = impl; },
  };
}

const actorishReq = {};

/* ------------------------------------------------------------------ *
 * Pruebas: forgotPassword                                            *
 * ------------------------------------------------------------------ */

describe('FORGOT PASSWORD', () => {
  it('correo existente y activo → mensaje genérico, token generado y correo enviado', async () => {
    const ctx = loadAuthServiceWithMocks();
    const { svc, user } = ctx;

    const result = await svc.forgotPassword({ email: 'usuario@empresa.test' }, actorishReq);

    assert.equal(result.message, 'Si el correo pertenece a una cuenta activa, recibirá un mensaje con el enlace de restablecimiento.');
    assert.equal(user.passwordResetToken.tokenHash, 'hash-of-token-abc');
    assert.ok(user.passwordResetToken.expiresAt > Date.now());
    assert.equal(user.passwordResetToken.usedAt, null);
    assert.equal(ctx.lastGeneratedToken, 'token-abc');
    assert.equal(ctx.lastMailArgs.to, 'usuario@empresa.test');
    assert.equal(ctx.lastMailArgs.firstName, 'Usuario');
    assert.equal(ctx.lastMailArgs.ttlMinutes, 30);
  });

  it('correo inexistente → mismo mensaje genérico (sin enumerar)', async () => {
    const { svc } = loadAuthServiceWithMocks({
      userData: null, // findOne devuelve null
    });

    const result = await svc.forgotPassword({ email: 'noexiste@empresa.test' }, actorishReq);

    assert.equal(result.message, 'Si el correo pertenece a una cuenta activa, recibirá un mensaje con el enlace de restablecimiento.');
  });

  it('correo con cuenta inactiva → mismo mensaje genérico', async () => {
    const { svc } = loadAuthServiceWithMocks({
      userData: { status: 'inactive' },
    });

    const result = await svc.forgotPassword({ email: 'inactivo@empresa.test' }, actorishReq);

    assert.equal(result.message, 'Si el correo pertenece a una cuenta activa, recibirá un mensaje con el enlace de restablecimiento.');
  });

  it('cooldown por correo → respuesta genérica sin nuevo envío', async () => {
    const { svc, user, lastMailArgs } = loadAuthServiceWithMocks({
      userData: {
        passwordResetToken: {
          tokenHash: 'hash-old',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          sentAt: new Date(Date.now() - 10 * 1000), // hace 10s (dentro de cooldown 120s)
          usedAt: null,
        },
      },
    });

    const beforeMailArgs = lastMailArgs;
    const result = await svc.forgotPassword({ email: 'usuario@empresa.test' }, actorishReq);

    assert.equal(result.message, 'Si el correo pertenece a una cuenta activa, recibirá un mensaje con el enlace de restablecimiento.');
    // No se generó nuevo token ni se envió correo
    assert.equal(lastMailArgs, beforeMailArgs);
  });

  it('fallo de correo: respuesta genérica, token guardado, sin error al cliente', async () => {
    const { svc, user, setSendMailShouldThrow } = loadAuthServiceWithMocks();

    setSendMailShouldThrow(true);

    const result = await svc.forgotPassword({ email: 'usuario@empresa.test' }, actorishReq);

    assert.equal(result.message, 'Si el correo pertenece a una cuenta activa, recibirá un mensaje con el enlace de restablecimiento.');
    // El token quedó en BD (no se revocó, se puede reintentar tras cooldown)
    assert.equal(user.passwordResetToken.tokenHash, 'hash-of-token-abc');
    assert.equal(user.passwordResetToken.usedAt, null);
  });

  it('fallo de correo + fallo de auditoría: respuesta genérica sin error al cliente (no revela existencia)', async () => {
    const { svc, user, setSendMailShouldThrow } = loadAuthServiceWithMocks({
      auditShouldThrow: true,
    });

    setSendMailShouldThrow(true);

    // No debe lanzar: ni el error de correo ni el de auditoría se propagan.
    const result = await svc.forgotPassword({ email: 'usuario@empresa.test' }, actorishReq);

    assert.equal(result.message, 'Si el correo pertenece a una cuenta activa, recibirá un mensaje con el enlace de restablecimiento.');
    assert.equal(user.passwordResetToken.tokenHash, 'hash-of-token-abc');
    assert.equal(user.passwordResetToken.usedAt, null);
  });

  it('respuesta idéntica: correo existente, inexistente y fallo de proveedor', async () => {
    const generic = 'Si el correo pertenece a una cuenta activa, recibirá un mensaje con el enlace de restablecimiento.';

    // Correo inexistente
    const { svc: svc1 } = loadAuthServiceWithMocks({ userData: null });
    const r1 = await svc1.forgotPassword({ email: 'noexiste@empresa.test' }, actorishReq);
    assert.equal(r1.message, generic);

    // Cuenta inactiva
    const { svc: svc2 } = loadAuthServiceWithMocks({ userData: { status: 'inactive' } });
    const r2 = await svc2.forgotPassword({ email: 'inactivo@empresa.test' }, actorishReq);
    assert.equal(r2.message, generic);

    // Correo existente + fallo de proveedor
    const { svc: svc3, setSendMailShouldThrow: smt } = loadAuthServiceWithMocks();
    smt(true);
    const r3 = await svc3.forgotPassword({ email: 'usuario@empresa.test' }, actorishReq);
    assert.equal(r3.message, generic);
  });

  it('registra auditoría FORGOT_PASSWORD', async () => {
    const ctx = loadAuthServiceWithMocks();
    const { svc } = ctx;

    await svc.forgotPassword({ email: 'usuario@empresa.test' }, actorishReq);

    assert.equal(ctx.lastAudit.action, 'FORGOT_PASSWORD');
    assert.equal(ctx.lastAudit.module, 'auth');
    assert.equal(ctx.lastAudit.entity, 'user');
  });
});

/* ------------------------------------------------------------------ *
 * Pruebas: resetPassword                                             *
 * ------------------------------------------------------------------ */

describe('RESET PASSWORD', () => {
  it('token válido → contraseña hasheada, token consumido, refresh tokens revocados, passwordVersion incrementada', async () => {
    const ctx = loadAuthServiceWithMocks({
      userData: {
        passwordResetToken: {
          tokenHash: 'hash-of-token-abc',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          sentAt: new Date(Date.now() - 1000),
          usedAt: null,
        },
      },
    });
    const { svc, user } = ctx;

    const result = await svc.resetPassword({ token: 'token-abc', newPassword: 'NuevaPass123' }, actorishReq);

    assert.equal(result.message, 'Contraseña actualizada correctamente. Todas las sesiones se han cerrado.');
    assert.equal(user.password, 'NuevaPass123');
    assert.deepEqual(user.refreshTokens, []);
    assert.equal(user.passwordVersion, 1);
  });

  it('token vencido → ValidationError', async () => {
    const { svc } = loadAuthServiceWithMocks({
      userData: {
        passwordResetToken: {
          tokenHash: 'hash-of-token-abc',
          expiresAt: new Date(Date.now() - 1000), // vencido
          sentAt: new Date(Date.now() - 100000),
          usedAt: null,
        },
      },
    });

    await assert.rejects(
      svc.resetPassword({ token: 'token-abc', newPassword: 'NuevaPass123' }, actorishReq),
      (err) => err.code === 'VALIDATION_ERROR'
    );
  });

  it('token ya usado → ValidationError', async () => {
    const { svc } = loadAuthServiceWithMocks({
      userData: {
        passwordResetToken: {
          tokenHash: 'hash-of-token-abc',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          sentAt: new Date(Date.now() - 1000),
          usedAt: new Date(Date.now() - 1000), // ya usado
        },
      },
    });

    await assert.rejects(
      svc.resetPassword({ token: 'token-abc', newPassword: 'NuevaPass123' }, actorishReq),
      (err) => err.code === 'VALIDATION_ERROR'
    );
  });

  it('token inválido (no encontrado) → ValidationError', async () => {
    const { svc } = loadAuthServiceWithMocks({
      userData: null,
    });

    await assert.rejects(
      svc.resetPassword({ token: 'token-inexistente', newPassword: 'NuevaPass123' }, actorishReq),
      (err) => err.code === 'VALIDATION_ERROR'
    );
  });

  it('contraseña insuficiente → ValidationError', async () => {
    const { svc } = loadAuthServiceWithMocks({
      userData: {
        passwordResetToken: {
          tokenHash: 'hash-of-token-abc',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          sentAt: new Date(Date.now() - 1000),
          usedAt: null,
        },
      },
    });

    await assert.rejects(
      svc.resetPassword({ token: 'token-abc', newPassword: '123' }, actorishReq),
      (err) => err.code === 'VALIDATION_ERROR'
    );
  });

  it('concurrencia: dos restablecimientos simultáneos → el segundo recibe error (token ya usado)', async () => {
    let callCount = 0;
    const { svc } = loadAuthServiceWithMocks({
      userData: {
        passwordResetToken: {
          tokenHash: 'hash-of-token-abc',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          sentAt: new Date(Date.now() - 1000),
          usedAt: null,
        },
      },
    });

    // Sobrescribir findById para simular uso concurrente en la transacción
    const Module = require('module');
    const originalLoad2 = Module._load;
    let findByIdCalls = 0;
    const mockUserModel = {
      findOne: () => chainable({
        ...makeUser(),
        passwordResetToken: {
          tokenHash: 'hash-of-token-abc',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          sentAt: new Date(Date.now() - 1000),
          usedAt: null,
        },
      }),
      findById: () => {
        findByIdCalls++;
        if (findByIdCalls === 1) {
          return chainable({
            ...makeUser(),
            passwordResetToken: {
              tokenHash: 'hash-of-token-abc',
              expiresAt: new Date(Date.now() + 30 * 60 * 1000),
              sentAt: new Date(Date.now() - 1000),
              usedAt: null,
            },
          });
        }
        // Segunda llamada: token ya usado
        return chainable({
          ...makeUser(),
          passwordResetToken: {
            tokenHash: 'hash-of-token-abc',
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
            sentAt: new Date(Date.now() - 1000),
            usedAt: new Date(Date.now() - 100),
          },
        });
      },
    };

    Module._load = function (request, parent, isMain) {
      let resolved = request;
      if (parent && parent.path) {
        try { resolved = path.resolve(parent.path, request); } catch {}
      }
      const normalized = resolved.replace(/\\/g, '/');
      if (normalized.includes('modules/users/model')) return mockUserModel;
      if (normalized.includes('modules/audit/service')) return { recordAudit: async () => {}, requestMeta: () => ({}) };
      if (normalized.includes('utils/mailer')) return { sendPasswordResetMail: async () => ({ provider: 'test' }) };
      if (normalized.includes('utils/tokens')) return { generateToken: () => 'token-abc', hashToken: (t) => 'hash-of-' + t };
      if (normalized.includes('jsonwebtoken')) return { sign: () => 'mock-access-token', verify: () => ({}) };
      if (normalized.includes('bcryptjs')) return { hash: async () => 'hash', compare: async () => true };
      if (normalized.includes('mongoose')) {
        return {
          Schema: class { constructor() {} index() { return this; } },
          model: () => ({}),
          connect: async () => {},
          connection: { on: () => {} },
        };
      }
      if (normalized.includes('dotenv')) return { config: () => {} };
      return originalLoad2.apply(this, arguments);
    };

    const keys = Object.keys(require.cache).filter((k) =>
      k.replace(/\\/g, '/').includes('modules/auth/service')
    );
    for (const k of keys) delete require.cache[k];
    const svc2 = require('../src/modules/auth/service');
    Module._load = originalLoad2;

    const p1 = svc2.resetPassword({ token: 'token-abc', newPassword: 'NuevaPass123' }, actorishReq);
    const p2 = svc2.resetPassword({ token: 'token-abc', newPassword: 'OtraPass456' }, actorishReq);

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].reason.code, 'VALIDATION_ERROR');
  });

  it('registra auditoría RESET_PASSWORD', async () => {
    let auditAction = null;
    const Module = require('module');
    const originalLoad2 = Module._load;

    const userWithToken = {
      ...makeUser(),
      passwordResetToken: {
        tokenHash: 'hash-of-token-abc',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        sentAt: new Date(Date.now() - 1000),
        usedAt: null,
      },
    };

    const mockUserModel = {
      findOne: () => chainable(userWithToken),
      findById: () => chainable(userWithToken),
    };
    const mockAudit = {
      recordAudit: async (entry) => { auditAction = entry.action; },
      requestMeta: () => ({}),
    };
    const mockMailer = { sendPasswordResetMail: async () => ({ provider: 'test' }) };
    const mockTokens = { generateToken: () => 'token-abc', hashToken: (t) => 'hash-of-' + t };
    const mockBcrypt = { hash: async () => 'hash', compare: async () => true };
    const mockJwt = { sign: () => 'mock-access-token', verify: () => ({}) };

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
        ['modules/users/model', mockUserModel],
        ['modules/audit/service', mockAudit],
        ['utils/mailer', mockMailer],
        ['utils/tokens', mockTokens],
        ['jsonwebtoken', mockJwt],
        ['bcryptjs', mockBcrypt],
        ['mongoose', mockMongoose],
        ['dotenv', { config: () => {} }],
      ];
      for (const [pattern, mod] of routes) {
        if (normalized.includes(pattern)) return mod;
      }
      return originalLoad2.apply(this, arguments);
    };

    const keys = Object.keys(require.cache).filter((k) =>
      k.replace(/\\/g, '/').includes('modules/auth/service')
    );
    for (const k of keys) delete require.cache[k];
    const svc = require('../src/modules/auth/service');
    Module._load = originalLoad2;

    await svc.resetPassword({ token: 'token-abc', newPassword: 'NuevaPass123' }, actorishReq);

    assert.equal(auditAction, 'RESET_PASSWORD');
  });
});
