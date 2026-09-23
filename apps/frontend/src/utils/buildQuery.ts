import type { QueryParams } from '../types/api';

/**
 * Construye la query string de un listado: descarta vacíos y codifica
 * números/booleanos. Devuelve '' o '?a=1&b=2'.
 */
export function buildQuery(params?: QueryParams): string {
  if (!params) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'boolean' && value === false) continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}
