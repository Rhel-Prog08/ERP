'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { runProbe: runLimitsProbe } = require('./probes/limits-probe');
const { runProbe: runRegisterCompanyProbe } = require('./probes/register-company-probe');

const AUTHORIZED_URI = 'mongodb://127.0.0.1:27017/erp_k2_regression?replicaSet=rs0';

function authorizedConnection() {
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
  };
}

function mockedDependencies(overrides = {}) {
  const calls = { connect: 0, requests: 0, writes: 0, reads: 0, disconnect: 0 };
  const dependencies = {
    environment: { TEST_MONGO_URI: AUTHORIZED_URI },
    app: {},
    connectDB: async () => {
      calls.connect += 1;
      return authorizedConnection();
    },
    disconnectDB: async () => {
      calls.disconnect += 1;
    },
    request: () => ({
      post: () => ({
        send: async () => {
          calls.requests += 1;
          calls.writes += 1;
          return { status: 400 };
        },
      }),
    }),
    Company: {
      countDocuments: async () => {
        calls.reads += 1;
        return 0;
      },
    },
    User: {
      countDocuments: async () => {
        calls.reads += 1;
        return 0;
      },
    },
    calls,
    ...overrides,
  };
  return dependencies;
}

const probes = [
  ['limits-probe', runLimitsProbe],
  ['register-company-probe', runRegisterCompanyProbe],
];

for (const [name, runProbe] of probes) {
  test(`${name} rechaza URI ausente sin fallback ni conexión`, async () => {
    const dependencies = mockedDependencies({
      environment: { MONGO_URI: AUTHORIZED_URI },
    });

    await assert.rejects(runProbe(dependencies), /TEST_MONGO_URI/);
    assert.equal(dependencies.calls.connect, 0);
    assert.equal(dependencies.calls.requests, 0);
    assert.equal(dependencies.calls.writes, 0);
  });

  test(`${name} rechaza URI incorrecta antes de conectar`, async () => {
    const dependencies = mockedDependencies({
      environment: {
        TEST_MONGO_URI: 'mongodb://127.0.0.1:27017/erp_test',
        MONGO_URI: AUTHORIZED_URI,
      },
    });

    await assert.rejects(runProbe(dependencies), /TEST_MONGO_URI/);
    assert.equal(dependencies.calls.connect, 0);
    assert.equal(dependencies.calls.requests, 0);
    assert.equal(dependencies.calls.writes, 0);
  });

  test(`${name} rechaza conexión efectiva no autorizada antes de operar`, async () => {
    const badConnection = authorizedConnection();
    badConnection.db.databaseName = 'erp_k2_browser';
    const dependencies = mockedDependencies({
      connectDB: async () => {
        dependencies.calls.connect += 1;
        return badConnection;
      },
    });

    await assert.rejects(runProbe(dependencies), /effective database or MongoDB server/);
    assert.equal(dependencies.calls.connect, 1);
    assert.equal(dependencies.calls.requests, 0);
    assert.equal(dependencies.calls.reads, 0);
    assert.equal(dependencies.calls.writes, 0);
    assert.equal(dependencies.calls.disconnect, 1);
  });
}
