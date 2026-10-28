'use strict';

/**
 * tests/mongoose.autoindex.test.js — Prueba de unidad de la configuración
 * de autoIndex de Mongoose.
 *
 * Verifica que en NODE_ENV=production se desactive explícitamente la
 * creación automática de índices (mongoose.set('autoIndex', false)), y
 * que en desarrollo/pruebas se mantenga activo. No conecta a MongoDB ni
 * crea ni elimina índices.
 */

const Module = require('module');
const path = require('path');
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const originalLoad = Module._load;

process.env.MONGO_URI = 'mongodb://localhost:27017/test';
process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-key-at-least-32-char';

describe('MONGOOSE AUTOINDEX — configuración por entorno', () => {
  it('desactiva autoIndex en producción (NODE_ENV=production)', () => {
    const setCalls = [];
    const mockMongoose = {
      set: (key, value) => { setCalls.push([key, value]); },
      Schema: class {},
      model: () => ({}),
      connect: async () => {},
      connection: { on: () => {} },
    };

    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = 'https://localhost:8081';

    Module._load = function (request, parent, isMain) {
      let resolved = request;
      if (parent && parent.path) {
        try { resolved = path.resolve(parent.path, request); } catch {}
      }
      const normalized = resolved.replace(/\\/g, '/');
      if (normalized.includes('mongoose')) return mockMongoose;
      return originalLoad.apply(this, arguments);
    };

    const keys = Object.keys(require.cache).filter((k) =>
      k.replace(/\\/g, '/').includes('config/db') ||
      k.replace(/\\/g, '/').includes('config/env')
    );
    for (const k of keys) delete require.cache[k];

    require('../src/config/db');

    Module._load = originalLoad;
    process.env.NODE_ENV = originalEnv;
    delete process.env.CLIENT_URL;

    assert.ok(
      setCalls.some(([k, v]) => k === 'autoIndex' && v === false),
      'esperado mongoose.set("autoIndex", false) en producción'
    );
  });

  it('mantiene autoIndex activo en desarrollo/pruebas', () => {
    const setCalls = [];
    const mockMongoose = {
      set: (key, value) => { setCalls.push([key, value]); },
      Schema: class {},
      model: () => ({}),
      connect: async () => {},
      connection: { on: () => {} },
    };

    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    Module._load = function (request, parent, isMain) {
      let resolved = request;
      if (parent && parent.path) {
        try { resolved = path.resolve(parent.path, request); } catch {}
      }
      const normalized = resolved.replace(/\\/g, '/');
      if (normalized.includes('mongoose')) return mockMongoose;
      return originalLoad.apply(this, arguments);
    };

    const keys = Object.keys(require.cache).filter((k) =>
      k.replace(/\\/g, '/').includes('config/db') ||
      k.replace(/\\/g, '/').includes('config/env')
    );
    for (const k of keys) delete require.cache[k];

    require('../src/config/db');

    Module._load = originalLoad;
    process.env.NODE_ENV = originalEnv;

    assert.ok(
      setCalls.some(([k, v]) => k === 'autoIndex' && v === true),
      'esperado mongoose.set("autoIndex", true) en desarrollo/pruebas'
    );
  });
});
