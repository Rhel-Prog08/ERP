'use strict';

const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');
const env = require('../config/env');

/** 404 para rutas no registradas bajo /api/v1. */
function notFoundHandler(req, res, next) {
  next(new NotFoundError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

/**
 * Middleware global de errores — único punto de traducción de errores.
 * Formato: { success:false, error:{ code, message, details? } }
 * Nunca expone stack traces ni mensajes internos de MongoDB en producción.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  // Error operacional nuestro → passthrough.
  if (!(error instanceof ApiError)) {
    // Mongoose: validación de esquema.
    if (err.name === 'ValidationError' && err.errors) {
      const details = Object.values(err.errors).map((e) => ({
        field: e.path,
        message: e.message,
      }));
      error = new ValidationError('Datos de entrada inválidos', details);
    } else if (err.name === 'CastError') {
      // Identificador con formato inválido (p. ej. ObjectId mal formado).
      error = new ValidationError('Identificador no válido', [
        { field: err.path, message: 'Formato de identificador inválido' },
      ]);
    } else if (err.code === 11000) {
      // Índice único duplicado (p. ej. SKU repetido en la empresa).
      const fields = Object.keys(err.keyValue || {});
      const ConflictError = require('./errors').ConflictError;
      error = new ConflictError(
        fields.length
          ? `El registro ya existe (${fields.join(', ')})`
          : 'El registro ya existe'
      );
    } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      const { AuthenticationError } = require('./errors');
      error = new AuthenticationError('Token inválido o expirado');
    } else if (err.type === 'entity.parse.failed') {
      error = new ValidationError('JSON malformado en el cuerpo de la petición');
    } else if (err.statusCode === 429 || err.status === 429) {
      // Rate limiting u otros errores 429 con formato propio.
      return res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Demasiadas peticiones. Intente de nuevo más tarde.' },
      });
    } else {
      // No reconocido → 500 genérico (no filtrar el mensaje interno).
      // eslint-disable-next-line no-console
      console.error('[error]', err);
      error = new (require('./errors').InternalServerError)();
    }
  }

  const body = {
    success: false,
    error: { code: error.code, message: error.message },
  };
  if (error.details) body.error.details = error.details;
  if (!env.isProd && error.statusCode >= 500 && err.stack) {
    body.error.stack = err.stack.split('\n').slice(0, 5); // sólo desarrollo
  }

  res.status(error.statusCode || 500).json(body);
}

module.exports = { notFoundHandler, errorHandler };
