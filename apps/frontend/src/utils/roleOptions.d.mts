import type { Role, Status } from '../types/models';

export function activeRoles(roles: Role[]): Role[];
export function roleAvailability(roles: Role[], roleId: string): Status | 'missing';
export function loadRoleCatalog(
  fetchRoles: () => Promise<Role[]>,
  getErrorMessage: (error: unknown) => string
): Promise<{ roles: Role[]; error: string | null }>;
