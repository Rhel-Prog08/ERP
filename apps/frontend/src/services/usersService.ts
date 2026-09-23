import { request } from './apiClient';
import type { Paginated, QueryParams } from '../types/api';
import type { User, UserCreateInput, UserUpdateInput } from '../types/models';

export const usersService = {
  list(params?: QueryParams): Promise<Paginated<User>> {
    return request<Paginated<User>>('/users', { query: params });
  },

  get(id: string): Promise<User> {
    return request<User>(`/users/${id}`);
  },

  create(input: UserCreateInput): Promise<User> {
    return request<User>('/users', { method: 'POST', body: input });
  },

  update(id: string, input: UserUpdateInput): Promise<User> {
    return request<User>(`/users/${id}`, { method: 'PATCH', body: input });
  },

  /** Baja lógica (DELETE /users/:id) → 409 si es el propio usuario. */
  deactivate(id: string): Promise<User> {
    return request<User>(`/users/${id}`, { method: 'DELETE' });
  },
};
