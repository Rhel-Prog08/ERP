'use strict';

const { STATUSES } = require('../../config/constants');

const statusEnum = { type: 'enum', enum: STATUSES };

/**
 * Teléfono México: exactamente 10 dígitos (0-9), siempre como String.
 * Se valida de nuevo en el modelo sólo cuando el campo se modifica
 * (documentos legacy con formato antiguo siguen editables en otros campos).
 */
const PHONE_PATTERN = /^[0-9]{10}$/;
const PHONE_PATTERN_MESSAGE = 'El teléfono debe contener exactamente 10 dígitos (0-9), sin letras, espacios ni signos';

const phoneRule = {
  type: 'string',
  pattern: PHONE_PATTERN,
  patternMessage: PHONE_PATTERN_MESSAGE,
};

/** GET /suppliers — paginación, búsqueda y filtros. */
const supplierListSchema = {
  page: { type: 'integer', min: 1 },
  limit: { type: 'integer', min: 1, max: 100 },
  sort: { type: 'string', maxLength: 40 },
  q: { type: 'string', maxLength: 80 },
  status: statusEnum,
};

/** POST /suppliers — supplierCode NO se acepta del cliente (lo genera el servidor). */
const supplierCreateSchema = {
  name: { required: true, type: 'string', minLength: 2, maxLength: 120 },
  companyName: { type: 'string', maxLength: 160 },
  email: { required: true, type: 'email' },
  phone: { required: true, ...phoneRule },
  address: { type: 'string', maxLength: 240 },
  status: statusEnum,
};

/** PATCH /suppliers/:id — todos opcionales; si el campo viaja, se valida. */
const supplierUpdateSchema = {
  name: { type: 'string', minLength: 2, maxLength: 120 },
  companyName: { type: 'string', maxLength: 160 },
  email: { type: 'email' },
  phone: phoneRule,
  address: { type: 'string', maxLength: 240 },
  status: statusEnum,
};

module.exports = { supplierListSchema, supplierCreateSchema, supplierUpdateSchema };
