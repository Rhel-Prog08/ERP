'use strict';

/**
 * Inicializa el replica set local de un nodo (rs0).
 * Solo necesario en desarrollo local con mongod --replSet rs0.
 * Uso: node scripts/init-replica.js
 * Atlas ya es replica set: nunca ejecutar esto contra Atlas.
 */

const { MongoClient } = require('mongodb');

const URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/?directConnection=true';

async function main() {
  const client = new MongoClient(URI, { directConnection: true });
  try {
    await client.connect();
    const admin = client.db('admin');
    try {
      const status = await admin.command({ replSetGetStatus: 1 }).catch((e) => e);
      if (status && status.ok === 1) {
        console.log('[replica] El replica set ya está inicializado.');
        return;
      }
    } catch {
      // no inicializado todavía
    }

    await admin.command({
      replSetInitiate: {
        _id: 'rs0',
        members: [{ _id: 0, host: '127.0.0.1:27017' }],
      },
    });
    console.log('[replica] replSetInitiate enviado. Esperando a que el nodo sea PRIMARY...');

    for (let i = 0; i < 30; i++) {
      try {
        const hello = await admin.command({ hello: 1 });
        if (hello.isWritablePrimary) {
          console.log('[replica] PRIMARY listo.');
          return;
        }
      } catch {
        // aún electionando
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    console.warn('[replica] El nodo no se volvió PRIMARY en 30s (¿es un solo nodo?).');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('[replica] Error:', err.message);
  process.exit(1);
});
