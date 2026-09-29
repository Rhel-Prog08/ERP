import { buildQuery } from '../utils/buildQuery';
import type {
  ApiErrorEnvelope,
  ApiFieldDetail,
  ApiResponse,
  AuthSession,
  QueryParams,
} from '../types/api';

/** URL base de la API (Expo inlina EXPO_PUBLIC_* en build). */
const appEnvironment = process.env.EXPO_PUBLIC_APP_ENV || 'development';
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL;
const isDevelopment = appEnvironment === 'development' && process.env.NODE_ENV !== 'production';

if (!isDevelopment && !configuredApiUrl) {
  throw new Error('Configura EXPO_PUBLIC_API_URL para builds preview y production.');
}

if (!isDevelopment && configuredApiUrl) {
  let apiUrl: URL;
  try {
    apiUrl = new URL(configuredApiUrl);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL debe ser una URL HTTPS válida en builds preview y production.');
  }
  const hostname = apiUrl.hostname.replace(/^\[|\]$/g, '');
  const isIpAddress =
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':');
  if (
    apiUrl.protocol !== 'https:' ||
    apiUrl.username ||
    apiUrl.password ||
    hostname === 'localhost' ||
    isIpAddress
  ) {
    throw new Error('EXPO_PUBLIC_API_URL debe usar HTTPS con un hostname (sin credenciales ni IP local) en builds preview y production.');
  }
}

export const API_BASE_URL = configuredApiUrl || 'http://localhost:4000/api/v1';

/** Error tipado del cliente: code/message/details + HTTP status. */
export class ApiError extends Error {
  code: string;
  status: number;
  details?: ApiFieldDetail[];

  constructor(
    message: string,
    options: { code?: string; status?: number; details?: ApiFieldDetail[] } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = options.code ?? 'UNKNOWN_ERROR';
    this.status = options.status ?? 0;
    this.details = options.details;
  }

  /** Mensaje de validación de un campo concreto (para FormField). */
  fieldError(field: string): string | undefined {
    return this.details?.find((d) => d.field === field)?.message;
  }

  /** Errores de validación sin campo concreto. */
  get formErrors(): string[] {
    return (this.details ?? []).filter((d) => !d.field).map((d) => d.message);
  }
}

/** Normaliza cualquier throw a ApiError (para estados de error de UI). */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof Error) return new ApiError(err.message, { code: 'UNKNOWN_ERROR' });
  return new ApiError('Error desconocido', { code: 'UNKNOWN_ERROR' });
}

/* ------------------------- Adaptador de sesión ------------------------- */

interface ApiAuthAdapter {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  onTokens(accessToken: string, refreshToken: string): void;
  onSessionExpired(): void;
}

let adapter: ApiAuthAdapter | null = null;

/** El AuthContext registra aquí el puente con la sesión (se llama 1 vez). */
export function configureApi(next: ApiAuthAdapter): void {
  adapter = next;
}

/* ------------------------------- Fetch base ------------------------------ */

async function rawFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Comprueba que la API esté activa.', {
      code: 'NETWORK_ERROR',
      status: 0,
    });
  }
}

interface ParsedBody {
  envelope: ApiResponse<unknown> | null;
  text: string;
}

async function parseBody(res: Response): Promise<ParsedBody> {
  const text = await res.text();
  if (!text) return { envelope: null, text: '' };
  try {
    const json = JSON.parse(text) as unknown;
    if (json && typeof json === 'object' && 'success' in json) {
      return { envelope: json as ApiResponse<unknown>, text };
    }
  } catch {
    // Respuesta no JSON (p. ej. página de error) → se trata como texto.
  }
  return { envelope: null, text };
}

/* ------------------------- Refresco de token (1×) ------------------------ */

let refreshPromise: Promise<boolean> | null = null;

/** Rotación de refresh token con un único reintento concurrente. */
function refreshOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function doRefresh(): Promise<boolean> {
  const refreshToken = adapter?.getRefreshToken();
  if (!adapter || !refreshToken) return false;
  try {
    const res = await rawFetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const { envelope } = await parseBody(res);
    if (res.status !== 200 || !envelope || !envelope.success) return false;
    const data = (envelope as { data: AuthSession }).data;
    adapter.onTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------- Requests ------------------------------- */

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  query?: QueryParams;
  /** No adjunta Authorization (login/refresh/logout). */
  skipAuth?: boolean;
  /** No intenta refrescar el token ante un 401. */
  skipRefresh?: boolean;
}

const AUTH_PATHS = new Set(['/auth/login', '/auth/refresh', '/auth/logout']);

/**
 * Petición central: sobre {success,data} | {success,error}, Authorization,
 * y ante un 401 hace UN refresh + reintento; si falla → cierre de sesión.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    query,
    skipAuth = false,
    skipRefresh = false,
  } = options;

  const url = `${API_BASE_URL}${path}${buildQuery(query)}`;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!skipAuth) {
    const token = adapter?.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await rawFetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const { envelope, text } = await parseBody(res);

  if (res.ok && envelope && envelope.success) {
    return envelope.data as T;
  }

  const errorEnvelope: ApiErrorEnvelope | null =
    envelope && !envelope.success ? envelope : null;
  const apiError = new ApiError(
    errorEnvelope?.error.message ??
      (text ? `Error del servidor (${res.status})` : `Error de red (${res.status})`),
    {
      code: errorEnvelope?.error.code ?? `HTTP_${res.status}`,
      status: res.status,
      details: errorEnvelope?.error.details,
    }
  );

  const canRefresh =
    res.status === 401 &&
    !skipRefresh &&
    !AUTH_PATHS.has(path) &&
    adapter !== null;

  if (canRefresh) {
    const refreshed = await refreshOnce();
    if (refreshed) return request<T>(path, options);
    adapter?.onSessionExpired();
  }

  throw apiError;
}

/* ------------------------------ Descarga CSV ----------------------------- */

export interface CsvDownload {
  blob: Blob;
  filename: string;
}

/** GET con ?format=csv: devuelve el blob y el nombre del archivo. */
export async function requestCsv(
  path: string,
  query?: QueryParams,
  retried = false
): Promise<CsvDownload> {
  const url = `${API_BASE_URL}${path}${buildQuery({ ...query, format: 'csv' })}`;
  const headers: Record<string, string> = {};
  const token = adapter?.getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await rawFetch(url, { method: 'GET', headers });

  if (res.status === 401 && !retried && adapter) {
    const refreshed = await refreshOnce();
    if (refreshed) return requestCsv(path, query, true);
    adapter.onSessionExpired();
    throw new ApiError('Sesión expirada', { code: 'AUTHENTICATION_ERROR', status: 401 });
  }

  if (!res.ok) {
    const { envelope, text } = await parseBody(res);
    const err = envelope && !envelope.success ? envelope : null;
    throw new ApiError(err?.error.message ?? `Error al exportar (${res.status})`, {
      code: err?.error.code ?? `HTTP_${res.status}`,
      status: res.status,
      details: err?.error.details,
    });
  }

  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = match?.[1] ?? `${path.replace(/\//g, '-')}.csv`;
  return { blob: await res.blob(), filename };
}

/** Dispara la descarga en web (document/URL nativos del navegador). */
export function downloadCsv(download: CsvDownload): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return false;
  const href = URL.createObjectURL(download.blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = download.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(href), 2000);
  return true;
}
