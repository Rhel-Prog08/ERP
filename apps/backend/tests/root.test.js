'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const api = request(app);

describe('API root route', () => {
  it('GET / returns the API information as JSON', async () => {
    const res = await api.get('/');

    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /^application\/json/);
    assert.deepEqual(res.body, {
      success: true,
      data: {
        name: 'CodeEvo ERP API',
        version: 'v1',
        status: 'online',
      },
    });
  });

  it('keeps the health endpoint and standard 404 response intact', async () => {
    const health = await api.get('/api/v1/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.success, true);
    assert.equal(health.body.data.status, 'ok');

    const missing = await api.get('/ruta-que-no-existe');
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.body, {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Ruta no encontrada: GET /ruta-que-no-existe',
      },
    });
  });
});
