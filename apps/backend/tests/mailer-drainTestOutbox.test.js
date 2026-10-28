'use strict';

/**
 * tests/mailer-drainTestOutbox.test.js — Prueba de regresión para
 * drainTestOutbox en src/utils/mailer.js.
 *
 * Importa el módulo REAL (sin mocks) para detectar el ReferenceError
 * que ocurrió cuando drainTestOutbox se exportaba sin estar definida.
 * No conecta a MongoDB ni envía correos reales.
 */

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { spawnSync } = require('child_process');
const path = require('path');

// Variables de entorno requeridas por config/env.js (fail-fast si faltan).
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/test';
process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-key-at-least-32-char';
process.env.NODE_ENV = 'test';

// Importa el módulo real de mailer.js (sin mocks).
const mailer = require('../src/utils/mailer');

describe('MAILER drainTestOutbox — regresión', () => {
  it('exporta drainTestOutbox como función (no ReferenceError)', () => {
    assert.equal(typeof mailer.drainTestOutbox, 'function');
  });

  it('devuelve un array y vacía el buzón en NODE_ENV=test', () => {
    // Llama al módulo real; puede haber mensajes previos de otros tests.
    const outbox = mailer.drainTestOutbox();

    assert.ok(Array.isArray(outbox), 'drainTestOutbox debe devolver un array');

    // Tras drenar, el buzón debe estar vacío.
    const empty = mailer.drainTestOutbox();
    assert.equal(empty.length, 0, 'el buzón debe quedar vacío tras drenar');
  });

  it('lanza MailError fuera de NODE_ENV=test', () => {
    const backendDir = path.join(__dirname, '..');

    const script =
      'process.env.NODE_ENV="production";' +
      'process.env.MONGO_URI="mongodb://127.0.0.1:27017/test";' +
      'process.env.JWT_SECRET="test-secret-key-at-least-32-chars-long";' +
      'process.env.REFRESH_TOKEN_SECRET="test-refresh-secret-key-at-least-32-char";' +
      'process.env.CLIENT_URL="https://localhost:8081";' +
      'process.env.APP_URL="https://localhost:8081";' +
      'const m=require("./src/utils/mailer");' +
      'try{m.drainTestOutbox();process.exit(1);}' +
      'catch(e){if(e.code==="MAIL_ERROR")process.exit(0);else process.exit(2);}';

    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: backendDir,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, 'debería salir con código 0 cuando lanza MAIL_ERROR');
  });
});
