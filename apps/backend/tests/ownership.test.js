'use strict';

/**
 * tests/ownership.test.js — unidad pura del guard de propietario (ownerUserId).
 * No requiere MongoDB ni variables de entorno: valida la lógica de
 * isOwnerOfCompany aislada (empresas legacy sin owner → false).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isOwnerOfCompany } = require('../src/utils/ownership');

describe('PROTECCIÓN DE PROPIETARIO — utilidad de ownership', () => {
  it('detecta que un usuario es el propietario de su empresa', () => {
    assert.equal(isOwnerOfCompany('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439011'), true);
  });

  it('no considera propietario a un usuario ajeno al owner', () => {
    assert.equal(isOwnerOfCompany('507f1f77bcf86cd799439012', '507f1f77bcf86cd799439011'), false);
  });

  it('devuelve false cuando el owner es null/absente (empresas legacy)', () => {
    assert.equal(isOwnerOfCompany('507f1f77bcf86cd799439011', null), false);
    assert.equal(isOwnerOfCompany('507f1f77bcf86cd799439011', undefined), false);
    assert.equal(isOwnerOfCompany('507f1f77bcf86cd799439011', ''), false);
  });

  it('devuelve false si el usuario objetivo no tiene owner (id nulo)', () => {
    assert.equal(isOwnerOfCompany(null, '507f1f77bcf86cd799439011'), false);
    assert.equal(isOwnerOfCompany(undefined, '507f1f77bcf86cd799439011'), false);
  });
});
