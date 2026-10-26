'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  assertAuthorizedTestConnection,
  assertAuthorizedTestUri,
  getAuthorizedTestUri,
  runDestructiveTestOperation,
} = require('./db-safety');

const AUTHORIZED_URI = 'mongodb://127.0.0.1:27017/erp_k2_regression?replicaSet=rs0';

function authorizedConnection(overrides = {}) {
  return {
    db: { databaseName: 'erp_k2_regression' },
    host: '127.0.0.1',
    port: 27017,
    client: {
      topology: {
        description: {
          servers: new Map([['127.0.0.1:27017', {}]]),
        },
      },
    },
    ...overrides,
  };
}

test('requiere TEST_MONGO_URI explícita sin fallback a otras variables', () => {
  assert.throws(() => getAuthorizedTestUri({}), /TEST_MONGO_URI/);
  assert.throws(
    () => getAuthorizedTestUri({ MONGO_URI: AUTHORIZED_URI }),
    /TEST_MONGO_URI/
  );
});

test('rechaza URI inválida, ambigua, con base no autorizada o servidor no local', () => {
  const rejectedUris = [
    '',
    'mongodb://',
    'mongodb+srv://cluster.example/erp_k2_regression',
    'mongodb://127.0.0.1:27017/erp',
    'mongodb://127.0.0.1:27017/erp_test',
    'mongodb://127.0.0.1:27017/erp_k2_browser',
    'mongodb://db.example:27017/erp_k2_regression',
    'mongodb://127.0.0.1:27017,db.example:27017/erp_k2_regression',
    'mongodb://127.0.0.1:27017,localhost:27017/erp_k2_regression',
    'mongodb://user:password@127.0.0.1:27017/erp_k2_regression',
    'mongodb://127.0.0.1:27017/erp_k2_regression?replicaSet=rs0&replicaSet=remote',
  ];

  for (const uri of rejectedUris) {
    assert.throws(() => assertAuthorizedTestUri(uri), undefined, uri);
  }
});

test('acepta solo el URI local explícitamente autorizado', () => {
  assert.equal(assertAuthorizedTestUri(AUTHORIZED_URI), AUTHORIZED_URI);
});

test('rechaza una base efectiva o destino MongoDB distintos de los autorizados', () => {
  const badConnections = [
    authorizedConnection({ db: { databaseName: 'erp_test' } }),
    authorizedConnection({ host: 'db.example' }),
    authorizedConnection({ port: 27018 }),
    authorizedConnection({
      client: {
        topology: {
          description: {
            servers: new Map([['db.example:27017', {}]]),
          },
        },
      },
    }),
    authorizedConnection({
      client: {
        topology: {
          description: {
            servers: new Map([
              ['127.0.0.1:27017', {}],
              ['db.example:27017', {}],
            ]),
          },
        },
      },
    }),
    authorizedConnection({
      client: { topology: { description: { servers: new Map() } } },
    }),
  ];

  for (const connection of badConnections) {
    assert.throws(
      () => assertAuthorizedTestConnection(AUTHORIZED_URI, connection),
      /effective database or MongoDB server/
    );
  }
});

test('una discrepancia de URI o conexión impide ejecutar operaciones destructivas', async () => {
  const destructiveSpies = {
    dropDatabaseCalls: 0,
    deleteManyCalls: 0,
    async dropDatabase() {
      this.dropDatabaseCalls += 1;
    },
    async deleteMany() {
      this.deleteManyCalls += 1;
    },
  };
  const operation = async () => {
    await destructiveSpies.dropDatabase();
    await destructiveSpies.deleteMany();
  };

  await assert.rejects(
    runDestructiveTestOperation({
      uri: 'mongodb://127.0.0.1:27017/erp_test',
      connection: authorizedConnection(),
      operation,
    })
  );
  await assert.rejects(
    runDestructiveTestOperation({
      uri: AUTHORIZED_URI,
      connection: authorizedConnection({ db: { databaseName: 'erp_k2_browser' } }),
      operation,
    })
  );

  assert.equal(destructiveSpies.dropDatabaseCalls, 0);
  assert.equal(destructiveSpies.deleteManyCalls, 0);
});

test('ejecuta la operación cuando URI y destino efectivo coinciden', async () => {
  let destructiveCalls = 0;
  const result = await runDestructiveTestOperation({
    uri: AUTHORIZED_URI,
    connection: authorizedConnection(),
    operation: async () => {
      destructiveCalls += 1;
      return 'authorized';
    },
  });

  assert.equal(result, 'authorized');
  assert.equal(destructiveCalls, 1);
});
