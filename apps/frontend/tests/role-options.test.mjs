import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { activeRoles, loadRoleCatalog, roleAvailability } from '../src/utils/roleOptions.mjs';

const roles = [
  { _id: 'active-role', name: 'Ventas', status: 'active' },
  { _id: 'inactive-role', name: 'Administrador', status: 'inactive' },
];

describe('role selector helpers', () => {
  it('offers only active roles for new assignments', () => {
    assert.deepEqual(activeRoles(roles).map((role) => role._id), ['active-role']);
  });

  it('identifies an inactive current role for an explicit UI warning', () => {
    assert.equal(roleAvailability(roles, 'inactive-role'), 'inactive');
    assert.equal(roleAvailability(roles, 'active-role'), 'active');
    assert.equal(roleAvailability(roles, 'deleted-role'), 'missing');
  });

  it('surfaces role-catalog failures and allows a subsequent retry', async () => {
    const message = 'No se pudieron cargar los roles';
    const failed = await loadRoleCatalog(
      async () => {
        throw new Error('request failed');
      },
      () => message
    );
    assert.deepEqual(failed, { roles: [], error: message });

    const retried = await loadRoleCatalog(async () => roles, () => 'unexpected');
    assert.deepEqual(retried, { roles, error: null });
  });
});
