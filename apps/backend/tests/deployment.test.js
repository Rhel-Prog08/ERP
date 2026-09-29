'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');

const app = require('../src/app');
const { setup, teardown, assertOk, assertError } = require('./helpers');

const api = request(app);

describe('Deployment endpoints', () => {
  before(setup);
  after(teardown);

  it('GET / devuelve información JSON de la API', async () => {
    const res = await api.get('/');
    assertOk(res, 200);
    assert.deepEqual(res.body.data, {
      name: 'CodeEvo ERP API',
      version: 'v1',
      status: 'online',
    });
  });

  it('health indica que API y MongoDB están disponibles', async () => {
    const res = await api.get('/api/v1/health');
    assertOk(res, 200);
    assert.equal(res.body.data.api, 'ok');
    assert.equal(res.body.data.database, 'connected');
  });

  it('health refleja la desconexión de MongoDB con HTTP 503', async () => {
    await mongoose.disconnect();
    const res = await api.get('/api/v1/health');
    assert.equal(res.status, 503);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.api, 'ok');
    assert.equal(res.body.data.database, 'disconnected');
  });

  it('las rutas desconocidas conservan el envelope de error estándar', async () => {
    const res = await api.get('/ruta-inexistente');
    assertError(res, 404, 'NOT_FOUND');
    assert.equal(res.body.error.message, 'Ruta no encontrada: GET /ruta-inexistente');
  });
});
