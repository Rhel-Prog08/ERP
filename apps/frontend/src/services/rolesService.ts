import { request } from './apiClient';
import type { Status } from '../types/models';
import type { Role } from '../types/models';

export interface RoleInput {
  name: string;
  permissions?: string[];
  status?: Status;
}

/** GET /roles devuelve un array (no paginado). */
export const rolesService = {
  list(): Promise<Role[]> {
    return request<Role[]>('/roles');
  },

  get(id: string): Promise<Role> {
    return request<Role>(`/roles/${id}`);
  },

  create(input: RoleInput): Promise<Role> {
    return request<Role>('/roles', { method: 'POST', body: input });
  },

  update(id: string, input: Partial<RoleInput>): Promise<Role> {
    return request<Role>(`/roles/${id}`, { method: 'PATCH', body: input });
  },

  remove(id: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/roles/${id}`, { method: 'DELETE' });
  },
};
