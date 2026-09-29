'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { withTransaction } = require('../src/config/db');

describe('Transaction availability guard', () => {
  it('rejects before running the operation when transactions are unavailable', async () => {
    let operationCalled = false;

    await assert.rejects(
      withTransaction(async () => {
        operationCalled = true;
      }),
      { code: 'TRANSACTIONS_UNAVAILABLE', statusCode: 503 }
    );
    assert.equal(operationCalled, false);
  });
});
