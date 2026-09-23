/**
 * Tipos del protocolo HTTP del ERP: sobre {success,data}/{success,error},
 * paginación estándar y sesión de autenticación.
 */

export interface ApiFieldDetail {
  field: string;
  message: string;
}

export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiFieldDetail[];
  };
}

export type ApiResponse<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

/** { items, pagination } que devuelven todos los listados paginados. */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  pagination: Pagination;
}

export interface SessionUserCompany {
  id: string;
  name: string;
}

export interface SessionUserRole {
  id: string;
  name: string;
  permissions: string[];
}

/** Usuario autenticado tal y lo serializa el backend (GET /auth/me). */
export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  company: SessionUserCompany;
  role: SessionUserRole | null;
}

/** Respuesta de POST /auth/login y /auth/refresh. */
export interface AuthSession {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;
