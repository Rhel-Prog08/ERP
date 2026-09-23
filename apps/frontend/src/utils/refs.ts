/**
 * Utilidades para referencias que el backend devuelve como string o como
 * documento poblado ({_id, ...}).
 */

type RefLike = string | { _id: string; [key: string]: unknown } | null | undefined;

export function refId(value: RefLike): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id ?? '';
}

export function refName(value: RefLike, field = 'name'): string {
  if (!value) return '';
  if (typeof value === 'string') return '';
  const raw = value[field];
  return typeof raw === 'string' ? raw : '';
}

/** Persona poblada {firstName,lastName} → "Nombre Apellido". */
export function personName(value: RefLike): string {
  if (!value || typeof value === 'string') return '';
  const first = typeof value.firstName === 'string' ? value.firstName : '';
  const last = typeof value.lastName === 'string' ? value.lastName : '';
  return `${first} ${last}`.trim();
}

/** Concatena partes opcionales ignorando vacíos. */
export function joinParts(...parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' · ');
}
