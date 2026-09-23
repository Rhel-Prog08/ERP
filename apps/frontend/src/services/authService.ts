import { request } from './apiClient';
import type { AuthSession, SessionUser } from '../types/api';

/** Endpoints de autenticación (login/refresh/logout sin Authorization). */
export const authService = {
  login(email: string, password: string): Promise<AuthSession> {
    return request<AuthSession>('/auth/login', {
      method: 'POST',
      body: { email, password },
      skipAuth: true,
      skipRefresh: true,
    });
  },

  refresh(refreshToken: string): Promise<AuthSession> {
    return request<AuthSession>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      skipAuth: true,
      skipRefresh: true,
    });
  },

  logout(refreshToken?: string): Promise<{ message: string }> {
    return request<{ message: string }>('/auth/logout', {
      method: 'POST',
      body: refreshToken ? { refreshToken } : {},
      skipAuth: true,
      skipRefresh: true,
    });
  },

  changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    });
  },

  me(): Promise<SessionUser> {
    return request<SessionUser>('/auth/me');
  },
};
