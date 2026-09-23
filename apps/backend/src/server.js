'use strict';

const app = require('./app');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');

async function main() {
  await connectDB();

  const server = app.listen(env.port, () => {
    console.log(`[api] ERP PyMES escuchando en http://localhost:${env.port}/api/v1`);
    console.log(`[api] entorno=${env.env} cors=${env.clientOrigins.join(', ')}`);
  });

  const shutdown = async (signal) => {
    console.log(`[api] ${signal} recibido, cerrando...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    // Cierre forzado si algo se queda colgado.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (err) => {
    console.error('[api] unhandledRejection:', err);
  });
}

main().catch((err) => {
  console.error('[api] No se pudo iniciar:', err.message);
  process.exit(1);
});
