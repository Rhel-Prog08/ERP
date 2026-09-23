'use strict';

/**
 * Protección contra NoSQL injection.
 * Rechaza claves que contengan operadores de Mongo ($...) o puntos,
 * tanto en body como en query, antes de que lleguen a los servicios.
 */
const { ValidationError } = require('../utils/errors');

function scan(value, path, errors, depth) {
  if (depth > 10) {
    errors.push({ field: path || 'body', message: 'Estructura demasiado profunda' });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => scan(item, `${path}[${i}]`, errors, depth + 1));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key.startsWith('$')) {
        errors.push({ field: `${path}.${key}`.replace(/^\./, ''), message: 'Clave no permitida (operador)' });
        continue;
      }
      if (key.includes('.')) {
        errors.push({ field: `${path}.${key}`.replace(/^\./, ''), message: 'Clave no permitida (punto)' });
        continue;
      }
      scan(child, path ? `${path}.${key}` : key, errors, depth + 1);
    }
  }
}

function sanitizeInput(req, res, next) {
  try {
    const errors = [];
    scan(req.body, 'body', errors, 0);
    scan(req.query, 'query', errors, 0);
    if (errors.length > 0) {
      throw new ValidationError('Claves de campo no permitidas', errors);
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { sanitizeInput };
