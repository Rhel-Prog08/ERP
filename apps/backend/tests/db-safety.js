'use strict';

const AUTHORIZED_URI_PATTERN =
  /^mongodb:\/\/127\.0\.0\.1:27017\/erp_k2_regression(?:\?replicaSet=rs0)?$/;
const AUTHORIZED_DATABASE = 'erp_k2_regression';
const AUTHORIZED_ADDRESS = '127.0.0.1:27017';

function assertAuthorizedTestUri(uri) {
  if (typeof uri !== 'string' || !AUTHORIZED_URI_PATTERN.test(uri)) {
    throw new Error(
      'Unsafe test database configuration: TEST_MONGO_URI must target the authorized local regression database.'
    );
  }
  return uri;
}

function getAuthorizedTestUri(environment = process.env) {
  return assertAuthorizedTestUri(environment.TEST_MONGO_URI);
}

function assertAuthorizedTestConnection(uri, connection) {
  assertAuthorizedTestUri(uri);

  const databaseName = connection && connection.db && connection.db.databaseName;
  const topologyServers =
    connection &&
    connection.client &&
    connection.client.topology &&
    connection.client.topology.description &&
    connection.client.topology.description.servers;
  const addresses = topologyServers && Array.from(topologyServers.keys());

  if (
    databaseName !== AUTHORIZED_DATABASE ||
    !connection ||
    connection.host !== '127.0.0.1' ||
    Number(connection.port) !== 27017 ||
    !addresses ||
    addresses.length === 0 ||
    addresses.some((address) => address !== AUTHORIZED_ADDRESS)
  ) {
    throw new Error(
      'Unsafe test database connection: the effective database or MongoDB server does not match the authorized local target.'
    );
  }
}

async function runDestructiveTestOperation({ uri, connection, operation }) {
  assertAuthorizedTestConnection(uri, connection);
  if (typeof operation !== 'function') {
    throw new TypeError('A destructive test operation callback is required.');
  }
  return operation();
}

module.exports = {
  assertAuthorizedTestConnection,
  assertAuthorizedTestUri,
  getAuthorizedTestUri,
  runDestructiveTestOperation,
};
