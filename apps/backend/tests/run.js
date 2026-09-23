'use strict';

/**
 * Ejecutador de pruebas multiplataforma.
 * Fija NODE_ENV y la base de datos de pruebas ANTES de cargar la app
 * (el prefijo de shell NODE_ENV=... no funciona en cmd.exe de Windows).
 */
const { spawnSync } = require('child_process');

const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', 'tests/'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PORT: '4001',
    MONGO_URI: 'mongodb://127.0.0.1:27017/erp_test?replicaSet=rs0',
    JWT_SECRET: process.env.JWT_SECRET || 'test_secret_solo_para_pruebas_a1b2c3d4',
    JWT_EXPIRES_IN: '10m',
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || 'test_refresh_solo_para_pruebas_e5f6g7h8',
    REFRESH_TOKEN_EXPIRES_IN: '1d',
    CLIENT_URL: 'http://localhost:8081',
  },
});

process.exit(result.status === null ? 1 : result.status);
