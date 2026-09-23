'use strict';

const { ValidationError } = require('./errors');

/**
 * Validador declarativo de entradas (sustituye a librerías externas).
 *
 * Características:
 * - Whitelist: sólo los campos declarados pasan a la petición
 *   (protección contra mass-assignment; un `companyId` del cliente se descarta).
 * - Tipos: string, number, integer, boolean, email, objectId, enum, array, object, date.
 * - Reglas: required, minLength/maxLength, min/max, pattern, items (subesquemas).
 * - Los errores se acumulan y se devuelven como VALIDATION_ERROR con details.
 *
 * Uso:
 *   router.post('/', validate({
 *     name: { required: true, type: 'string', minLength: 2, maxLength: 120 },
 *     email: { required: true, type: 'email' },
 *     items: { required: true, type: 'array', minLength: 1, items: { type: 'objectId' } },
 *   }), controller.create);
 */

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isEmpty(v) {
  return v === undefined || v === null || v === '';
}

function checkString(value, rule, errors, field) {
  if (typeof value !== 'string') {
    errors.push({ field, message: 'Debe ser texto' });
    return undefined;
  }
  let out = value.trim();
  if (rule.minLength !== undefined && out.length < rule.minLength) {
    errors.push({ field, message: `Mínimo ${rule.minLength} caracteres` });
  }
  if (rule.maxLength !== undefined && out.length > rule.maxLength) {
    errors.push({ field, message: `Máximo ${rule.maxLength} caracteres` });
  }
  if (rule.pattern && !rule.pattern.test(out)) {
    errors.push({ field, message: rule.patternMessage || 'Formato no válido' });
  }
  if (rule.lowercase) out = out.toLowerCase();
  if (rule.enum && !rule.enum.includes(out)) {
    errors.push({ field, message: `Valor no permitido. Opciones: ${rule.enum.join(', ')}` });
  }
  return out;
}

function checkNumber(value, rule, errors, field, { coerce = false } = {}) {
  let n = value;
  if (coerce && typeof n === 'string') n = Number(n);
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    errors.push({ field, message: 'Debe ser un número' });
    return undefined;
  }
  if (rule.integer && !Number.isInteger(n)) {
    errors.push({ field, message: 'Debe ser un número entero' });
  }
  if (rule.min !== undefined && n < rule.min) {
    errors.push({ field, message: `Debe ser ≥ ${rule.min}` });
  }
  if (rule.max !== undefined && n > rule.max) {
    errors.push({ field, message: `Debe ser ≤ ${rule.max}` });
  }
  return n;
}

function checkValue(value, rule, field, errors, opts) {
  const { coerce = false } = opts;

  if (isEmpty(value)) {
    if (rule.required) errors.push({ field, message: 'Es obligatorio' });
    return undefined;
  }

  switch (rule.type) {
    case 'string':
    case 'enum': {
      if (rule.type === 'enum' && !rule.enum) throw new Error(`Regla enum sin valores: ${field}`);
      return checkString(value, rule, errors, field);
    }
    case 'email': {
      if (typeof value !== 'string' || !EMAIL_RE.test(value.trim())) {
        errors.push({ field, message: 'Email no válido' });
        return undefined;
      }
      return value.trim().toLowerCase();
    }
    case 'number':
      return checkNumber(value, rule, errors, field, { coerce });
    case 'integer':
      return checkNumber(value, { ...rule, integer: true }, errors, field, { coerce });
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      if (coerce && (value === 'true' || value === 'false')) return value === 'true';
      errors.push({ field, message: 'Debe ser verdadero o falso' });
      return undefined;
    }
    case 'objectId': {
      const str = String(value);
      if (!OBJECT_ID_RE.test(str)) {
        errors.push({ field, message: 'Identificador no válido' });
        return undefined;
      }
      return str;
    }
    case 'date': {
      const d = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(d.getTime())) {
        errors.push({ field, message: 'Fecha no válida' });
        return undefined;
      }
      return d;
    }
    case 'array': {
      if (!Array.isArray(value)) {
        errors.push({ field, message: 'Debe ser una lista' });
        return undefined;
      }
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        errors.push({ field, message: `Mínimo ${rule.minLength} elementos` });
      }
      if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        errors.push({ field, message: `Máximo ${rule.maxLength} elementos` });
      }
      if (!rule.items) return value;
      return value.map((item, i) => checkValue(item, rule.items, `${field}[${i}]`, errors, opts));
    }
    case 'object': {
      if (!isPlainObject(value)) {
        errors.push({ field, message: 'Debe ser un objeto' });
        return undefined;
      }
      if (!rule.schema) return value;
      return validateObject(value, rule.schema, field, errors, opts);
    }
    default:
      return value;
  }
}

/** Valida un objeto contra un esquema; devuelve copia saneada (whitelist). */
function validateObject(source, schema, prefix, errors, opts) {
  const out = {};
  const base = prefix ? `${prefix}.` : '';
  for (const [key, rule] of Object.entries(schema)) {
    const raw = source[key];
    const value = checkValue(raw, rule, `${base}${key}`, errors, opts);
    if (value !== undefined) out[key] = value;
  }
  // Whitelist: campos no declarados (p.ej. companyId) se eliminan.
  return out;
}

function runValidation(req, res, next) {
  try {
    const { schema, source } = this;
    const errors = [];
    const opts = { coerce: this.coerce === true };
    const clean = validateObject(req[source] || {}, schema, '', errors, opts);
    if (errors.length > 0) {
      throw new ValidationError('Datos de entrada inválidos', errors);
    }
    req[source] = clean;
    next();
  } catch (err) {
    next(err);
  }
}

/** Valida req.body (tipos estrictos JSON). Whitelist de campos declarados. */
function validate(schema) {
  return runValidation.bind({ schema, source: 'body', coerce: false });
}

/** Valida req.query (conversión string→number/boolean; la query llega como texto). */
function validateQuery(schema) {
  return runValidation.bind({ schema, source: 'query', coerce: true });
}

module.exports = { validate, validateQuery, OBJECT_ID_RE, EMAIL_RE };
