import { request } from './apiClient';
import type { AuthSession, SessionUser } from '../types/api';

/** Respuesta de POST /auth/register-company (registro público multiempresa). */
export interface RegisterCompanyResult {
  company: { id: string; name: string };
  user: { id: string; firstName: string; lastName: string; email: string };
  emailSent: boolean;
  message: string;
}

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

  /**
   * Registro público CON invitación. El backend puede responder
   * REGISTRATION_DISABLED (503) si no está habilitado el registro.
   */
  register(input: {
    inviteToken: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    passwordConfirm: string;
  }): Promise<{ user: { id: string }; emailSent: boolean; message: string }> {
    return request<{ user: { id: string }; emailSent: boolean; message: string }>(
      '/auth/register',
      {
        method: 'POST',
        body: input,
        skipAuth: true,
        skipRefresh: true,
      }
    );
  },

  /**
   * Registro público MULTIEMPRESA (sin invitación): crea empresa propia y
   * administrador. El backend puede responder REGISTRATION_DISABLED (503)
   * si el registro no está habilitado.
   */
  registerCompany(input: {
    companyName: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    passwordConfirm: string;
  }): Promise<RegisterCompanyResult> {
    return request<RegisterCompanyResult>('/auth/register-company', {
      method: 'POST',
      body: input,
      skipAuth: true,
      skipRefresh: true,
    });
  },

  verifyEmail(token: string): Promise<{ message: string }> {
    return request<{ message: string }>('/auth/verify-email', {
      method: 'POST',
      body: { token },
      skipAuth: true,
      skipRefresh: true,
    });
  },

  /** Respuesta SIEMPRE genérica en el servidor (no revela si el correo existe). */
  resendVerification(email: string): Promise<{ message: string }> {
    return request<{ message: string }>('/auth/resend-verification', {
      method: 'POST',
      body: { email },
      skipAuth: true,
      skipRefresh: true,
    });
  },

  /** Solicitud de restablecimiento de contraseña (respuesta genérica). */
  forgotPassword(email: string): Promise<{ message: string }> {
    return request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: { email },
      skipAuth: true,
      skipRefresh: true,
    });
  },

  /** Restablecimiento de contraseña con token de un solo uso. */
  resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: { token, newPassword },
      skipAuth: true,
      skipRefresh: true,
    });
  },
};
