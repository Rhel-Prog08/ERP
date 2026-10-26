/**
 * Validaciones de contacto compartidas (reglas México) para clientes y
 * proveedores. Espejo de apps/backend/src/modules/{customers,suppliers}/validation.js:
 * frontend y backend deben rechazar exactamente lo mismo.
 */

export const PHONE_MX_RE = /^[0-9]{10}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const NAME_MIN = 2;
export const NAME_MAX = 120;
export const COMPANY_MAX = 160;
export const ADDRESS_MAX = 240;

export const PHONE_MAXLENGTH_INPUT = 10;

const MSG_NAME_REQUIRED = 'El nombre es obligatorio';
const MSG_NAME_SHORT = `El nombre debe tener al menos ${NAME_MIN} caracteres`;
const MSG_NAME_LONG = `El nombre no puede superar ${NAME_MAX} caracteres`;
const MSG_PHONE_REQUIRED = 'El teléfono es obligatorio';
const MSG_PHONE_SHORT = (missing: number) =>
  `El teléfono debe tener exactamente 10 dígitos (falta${missing === 1 ? '' : 'n'} ${missing})`;
const MSG_PHONE_LONG = 'El teléfono no puede tener más de 10 dígitos';
const MSG_PHONE_INVALID = 'El teléfono sólo puede contener dígitos del 0 al 9 (sin letras, espacios ni signos)';
const MSG_EMAIL_REQUIRED = 'El correo electrónico es obligatorio';
const MSG_EMAIL_INVALID = 'El correo electrónico no tiene un formato válido';
const MSG_COMPANY_LONG = `La empresa no puede superar ${COMPANY_MAX} caracteres`;
const MSG_ADDRESS_LONG = `La dirección no puede superar ${ADDRESS_MAX} caracteres`;
// Conservación: el PATCH omite los campos vaciados y el backend mantiene el
// valor, así que se bloquea el vaciado para no simular una eliminación.
const MSG_PHONE_KEEP = 'No se puede vaciar el teléfono: se conserva el valor actual. Escribe un nuevo número para reemplazarlo.';
const MSG_EMAIL_KEEP = 'No se puede vaciar el correo: se conserva el valor actual. Escribe un correo nuevo para reemplazarlo.';
const MSG_COMPANY_KEEP = 'No se puede vaciar la empresa: se conserva el valor actual. Escribe uno nuevo para reemplazarlo.';
const MSG_ADDRESS_KEEP = 'No se puede vaciar la dirección: se conserva el valor actual. Escribe una nueva para reemplazarla.';

/** Elimina espacios extremos (el backend también recorta). */
export function trimValue(value: string): string {
  return value.trim();
}

export function validateName(value: string, { required = true }: { required?: boolean } = {}): string | undefined {
  const v = value.trim();
  if (!v) return required ? MSG_NAME_REQUIRED : undefined;
  if (v.length < NAME_MIN) return MSG_NAME_SHORT;
  if (v.length > NAME_MAX) return MSG_NAME_LONG;
  return undefined;
}

/**
 * Teléfono MX: exactamente 10 dígitos 0-9, siempre String.
 * Se informa un mensaje concreto según el problema detectado.
 */
export function validatePhone(value: string, { required = true }: { required?: boolean } = {}): string | undefined {
  const v = value.trim();
  if (!v) return required ? MSG_PHONE_REQUIRED : undefined;
  if (!/^[0-9]+$/.test(v)) return MSG_PHONE_INVALID;
  if (v.length < 10) return MSG_PHONE_SHORT(10 - v.length);
  if (v.length > 10) return MSG_PHONE_LONG;
  return undefined;
}

/** Formato de email (no confundir con verificación de propiedad). */
export function validateEmail(value: string, { required = true }: { required?: boolean } = {}): string | undefined {
  const v = value.trim();
  if (!v) return required ? MSG_EMAIL_REQUIRED : undefined;
  if (!EMAIL_RE.test(v)) return MSG_EMAIL_INVALID;
  return undefined;
}

export function validateCompanyName(value: string): string | undefined {
  if (value.trim().length > COMPANY_MAX) return MSG_COMPANY_LONG;
  return undefined;
}

export function validateAddress(value: string): string | undefined {
  if (value.trim().length > ADDRESS_MAX) return MSG_ADDRESS_LONG;
  return undefined;
}

export interface ContactFormValues {
  name: string;
  email: string;
  phone: string;
  companyName: string;
  address: string;
}

export type ContactFormErrors = Partial<Record<keyof ContactFormValues, string>>;

export interface ContactValidateOptions {
  /** true en creación: email y teléfono obligatorios. */
  requireContact: boolean;
  /**
   * Edición: valores originales del registro. Un campo no modificado no se
   * valida (permite editar registros históricos sin rechazar datos previos).
   */
  original?: Partial<ContactFormValues>;
}

function isChanged(value: string, original: string | undefined): boolean {
  return value.trim() !== (original ?? '').trim();
}

/**
 * Valida el formulario completo de cliente/proveedor.
 * Creación: nombre, email y teléfono obligatorios.
 * Edición: se valida sólo lo modificado (teléfono → exactamente 10 dígitos;
 * email → formato válido); lo no modificado no se envía al backend.
 * Conservación: vaciar un campo con valor en edición queda bloqueado con
 * mensaje (el backend mantendría el dato y no debe simularse su borrado).
 */
export function validateContactForm(
  values: ContactFormValues,
  { requireContact, original }: ContactValidateOptions
): ContactFormErrors {
  const errors: ContactFormErrors = {};
  const nameError = validateName(values.name);
  if (nameError) errors.name = nameError;

  if (original !== undefined && (original.email ?? '').trim() && !values.email.trim()) {
    errors.email = MSG_EMAIL_KEEP;
  } else if (requireContact || original === undefined || isChanged(values.email, original.email)) {
    const emailError = validateEmail(values.email, { required: requireContact });
    if (emailError) errors.email = emailError;
  }

  if (original !== undefined && (original.phone ?? '').trim() && !values.phone.trim()) {
    errors.phone = MSG_PHONE_KEEP;
  } else if (requireContact || original === undefined || isChanged(values.phone, original.phone)) {
    const phoneError = validatePhone(values.phone, { required: requireContact });
    if (phoneError) errors.phone = phoneError;
  }

  if (original !== undefined && (original.companyName ?? '').trim() && !values.companyName.trim()) {
    errors.companyName = MSG_COMPANY_KEEP;
  } else if (original === undefined || isChanged(values.companyName, original.companyName)) {
    const companyError = validateCompanyName(values.companyName);
    if (companyError) errors.companyName = companyError;
  }

  if (original !== undefined && (original.address ?? '').trim() && !values.address.trim()) {
    errors.address = MSG_ADDRESS_KEEP;
  } else if (original === undefined || isChanged(values.address, original.address)) {
    const addressError = validateAddress(values.address);
    if (addressError) errors.address = addressError;
  }

  return errors;
}

/** Normaliza valores antes de enviarlos al API (espejo del backend). */
export function normalizeContactValues(values: ContactFormValues): ContactFormValues {
  return {
    name: values.name.trim(),
    email: values.email.trim().toLowerCase(),
    phone: values.phone.trim(),
    companyName: values.companyName.trim(),
    address: values.address.trim(),
  };
}

const EDITABLE_CONTACT_KEYS = ['email', 'phone', 'companyName', 'address'] as const;

/** Payload de contacto: nombre siempre presente; resto opcional. */
export type ContactPayload = Partial<ContactFormValues> & { name: string };

/**
 * Construye el payload del formulario.
 * Creación (sin `original`): envía todo.
 * Edición: envía siempre el nombre y sólo los campos de contacto modificados
 * con contenido; nunca envía valores antiguos inválidos ni vacíos.
 */
export function buildContactPayload(
  values: ContactFormValues,
  original?: Partial<ContactFormValues>
): ContactPayload {
  const normalized = normalizeContactValues(values);
  const payload: ContactPayload = { name: normalized.name };
  if (original === undefined) {
    return { ...normalized };
  }
  for (const key of EDITABLE_CONTACT_KEYS) {
    const before = (original[key] ?? '').trim();
    if (normalized[key] && normalized[key] !== before) {
      payload[key] = normalized[key];
    }
  }
  return payload;
}
