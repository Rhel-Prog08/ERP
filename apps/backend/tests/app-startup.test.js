'use strict';

/**
 * tests/app-startup.test.js — Prueba de arranque de Express sin MongoDB.
 *
 * Carga el módulo real src/app.js (sin mocks) para verificar que todas las
 * rutas se registran correctamente y que la aplicación puede iniciarse.
 * No conecta a MongoDB (esa conexión ocurre en src/server.js, no en app.js).
 * Usa variables de entorno ficticias compatibles con NODE_ENV=production.
 */

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

// Variables de entorno ficticias para NODE_ENV=production (no reales, no secretos).
process.env.NODE_ENV = 'production';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/fake-for-startup-test';
process.env.JWT_SECRET = 'fake-jwt-secret-key-for-testing-only-min-32-chars';
process.env.REFRESH_TOKEN_SECRET = 'fake-refresh-secret-key-for-testing-only-min-32-ch';
process.env.CLIENT_URL = 'https://erp.test.example.com';
process.env.APP_URL = 'https://erp.test.example.com';

// app.js no conecta a MongoDB (eso lo hace server.js). Solo carga rutas y middleware.
const app = require('../src/app');

/**
 * Recorre recursivamente el stack de un router Express y sus sub-routers
 * para recolectar todas las rutas registradas. Las rutas de Express usan
 * expresiones regulares internas; las normaliza a strings de ruta simples.
 */
function collectRoutes(stack, prefix = '') {
  const paths = new Set();
  for (const layer of stack) {
    if (layer.route) {
      // layer.route.path es una string con sintaxis de regex de Express.
      // Normaliza: elimina anclas ^$, convierte \/ a /, y quita
      // los lookaheads opcionales /?(?=/|$) que Express inserta.
      let p = layer.route.path;
      p = p.replace(/^\^/, '').replace(/\/?\$\/?$/, '');
      p = p.replace(/\\\//g, '/');
      p = p.replace(/\/\?\(\?=\/\|\$\)/g, '');
      while (p.includes('//')) p = p.replace('//', '/');
      paths.add(prefix + p);
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      // Sub-router: montar sus rutas con el prefijo de este router
      const mountPath = layer.regexp ? layer.regexp.source : '';
      const cleanMount = mountPath.replace(/^\^/, '').replace(/\/?\$\/?$/, '');
      const normalizedMount = cleanMount.replace(/\\\//g, '/').replace(/\/\?\(\?=\/\|\$\)/g, '');
      while (normalizedMount.includes('//')) normalizedMount = normalizedMount.replace('//', '/');
      const subPaths = collectRoutes(layer.handle.stack, prefix + normalizedMount);
      for (const sp of subPaths) paths.add(sp);
    }
  }
  return paths;
}

describe('APP startup — carga de Express sin MongoDB', () => {
  it('require del módulo app no lanza ReferenceError ni errores de importación', () => {
    assert.ok(app, 'app debe exportarse');
    assert.equal(typeof app, 'function', 'app debe ser una función (Express app)');
  });

  it('todas las rutas de API están registradas bajo /api/v1', () => {
    const paths = collectRoutes(app._router.stack);

    // Rutas críticas que deben existir tras la corrección del import.
    // Se usa incluye() porque Express guarda rutas como expresiones regulares.
    const required = [
      '/api/v1/auth/login',
      '/api/v1/auth/register',
      '/api/v1/auth/forgot-password',
      '/api/v1/auth/reset-password',
      '/api/v1/users/invitations/resend',
    ];

    for (const expected of required) {
      const found = [...paths].some((p) => p.includes(expected));
      assert.ok(found, `ruta ${expected} debe estar registrada en la app`);
    }
  });

  it('la ruta POST /users/invitations/resend tiene middlewares aplicados', () => {
    const paths = collectRoutes(app._router.stack);
    assert.ok(
      [...paths].some((p) => p.includes('/api/v1/users/invitations/resend')),
      'POST /users/invitations/resend debe existir'
    );

    // Verificar que la ruta tiene middlewares (incluye invitationResendLimiter)
    app._router.stack.forEach((layer) => {
      if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        layer.handle.stack.forEach((ul) => {
          if (ul.route && ul.route.path && ul.route.path.includes('invitations/resend')) {
            assert.ok(ul.route.stack.length > 0, 'la ruta debe tener middlewares');
            const middlewareNames = ul.route.stack.map((m) => m.name || m.handle.name || '');
            assert.ok(
              middlewareNames.some((n) => n.includes('invitationResend') || n.includes('rateLimit')),
              'invitationResendLimiter debe estar entre los middlewares de la ruta'
            );
          }
        });
      }
    });
  });
});
