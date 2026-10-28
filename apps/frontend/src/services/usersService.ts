import { request } from './apiClient';
import type { Paginated, QueryParams } from '../types/api';
import type { Invitation, User, UserCreateInput, UserUpdateInput } from '../types/models';

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

  /* ------------------------- Invitaciones de registro ------------------------ */

  /** Crea la invitación y el backend envía el correo real (o devuelve 502). */
  createInvitation(input: {
    email: string;
    firstName: string;
    lastName: string;
    roleId: string;
  }): Promise<Invitation> {
    return request<Invitation>('/users/invitations', { method: 'POST', body: input });
  },

  listInvitations(params?: QueryParams): Promise<Paginated<Invitation>> {
    return request<Paginated<Invitation>>('/users/invitations', { query: params });
  },

  /** Reenvía invitación pendiente (rota token) o crea nueva si ya fue usada/revocada. */
  resendInvitation(input: {
    email: string;
    firstName?: string;
    lastName?: string;
    roleId?: string;
  }): Promise<Invitation> {
    return request<Invitation>('/users/invitations/resend', { method: 'POST', body: input });
  },

  revokeInvitation(id: string): Promise<Invitation> {
    return request<Invitation>(`/users/invitations/${id}`, { method: 'DELETE' });
  },
};
