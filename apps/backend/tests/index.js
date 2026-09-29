'use strict';

/**
 * tests/index.js — PUENTE DE DESCUBRIMIENTO DEL RUNNER (no es un test).
 *
 * BUG DEL HARNESS EN NODE 24: tests/run.js invoca
 *     node --test --test-concurrency=1 tests/
 * pero desde la interpretación de argumentos como *globs* (Node ≥ 21/24),
 * `node --test <directorio>` NO recorre el directorio: toma la ruta literal
 * como fichero de entrada y el proceso hijo falla con MODULE_NOT_FOUND
 * ("Cannot find module '...backend\tests'"), de modo que `npm test` no
 * ejecutaba NINGUNA prueba.
 *
 * Solución SIN tocar tests/run.js (prohibido por el encargo): este archivo
 * permite que la ruta `tests/` resuelva como entrada (tests/index.js) y
 * carga las 8 suites *.test.js. node:test las registra todas en el mismo
 * proceso y las ejecuta EN ORDEN Y SERIALIZADAS (cada describe ejecuta su
 * propio before(setup) con dropDatabase, por lo que el aislamiento entre
 * archivos se mantiene igual que con un proceso por archivo).
 *
 * Cada suite sigue siendo ejecutable por separado con el patrón glob
 * tests/…/*.test.js (un proceso por archivo).
 */

require('./transactions.test');
require('./auth.test');
require('./rbac.test');
require('./products.test');
require('./inventory.test');
require('./purchases.test');
require('./sales.test');
require('./multiempresa.test');
require('./e2e.test');
require('./deployment.test');
