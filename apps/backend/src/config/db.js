'use strict';

const mongoose = require('mongoose');
const env = require('./env');

/**
 * Conexión a MongoDB + soporte de transacciones.
 *
 * Las transacciones de MongoDB requieren replica set (Atlas lo es; en local
 * arrancamos mongod con --replSet rs0). Si el servidor no es replica set,
 * `withTransaction` ejecuta la función sin sesión y se emite un aviso:
 * es el comportamiento "cuando sean posibles" que pide el diseño.
 */

let txSupported = false;

/** Oculta credenciales de la URI en los logs. */
function sanitizeUri(uri) {
  return String(uri).replace(/\/\/([^@/]+)@/, '//***@');
}

async function connectDB(uri = env.mongoUri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    txSupported = Boolean(hello.setName) || hello.msg === 'isdbgrid';
  } catch {
    txSupported = false;
  }

  if (!txSupported) {
    console.warn('[db] AVISO: el servidor NO es replica set => transacciones deshabilitadas.');
    console.warn('[db] Para paridad con Atlas en local: mongod --replSet rs0');
  }
  console.log(`[db] Conectado a ${sanitizeUri(uri)}`);
  return mongoose.connection;
}

function transactionsSupported() {
  return txSupported;
}

/**
 * Ejecuta `fn(session)` dentro de una transacción cuando el servidor la
 * soporta; en caso contrario la ejecuta sin sesión (session = null).
 * Los servicios deben propagar `session` a todas las operaciones.
 */
async function withTransaction(fn) {
  if (!txSupported) return fn(null);

  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function disconnectDB() {
  await mongoose.disconnect();
}

mongoose.connection.on('error', (err) => {
  console.error(`[db] error de conexión: ${err.message}`);
});
mongoose.connection.on('disconnected', () => {
  console.warn('[db] desconectado');
});

module.exports = { connectDB, disconnectDB, transactionsSupported, withTransaction };
