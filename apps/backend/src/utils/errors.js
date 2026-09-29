'use strict';

/**
 * Jerarquía centralizada de errores de API.
 * El errorHandler global traduce cualquier error a:
 *   { success:false, error:{ code, message, details? } }
 * Nunca se exponen stack traces ni detalles internos de MongoDB.
 */

class ApiError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

class ValidationError extends ApiError {
  constructor(message = 'Datos de entrada inválidos', details) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

class AuthenticationError extends ApiError {
  constructor(message = 'No autenticado') {
    super(401, 'AUTHENTICATION_ERROR', message);
  }
}

class AuthorizationError extends ApiError {
  constructor(message = 'No tienes permisos para realizar esta operación') {
    super(403, 'AUTHORIZATION_ERROR', message);
  }
}

class NotFoundError extends ApiError {
  constructor(message = 'Recurso no encontrado') {
    super(404, 'NOT_FOUND', message);
  }
}

class ConflictError extends ApiError {
  constructor(message = 'El recurso entra en conflicto con el estado actual') {
    super(409, 'CONFLICT', message);
  }
}

class DatabaseError extends ApiError {
  constructor(message = 'Error de base de datos') {
    super(500, 'DATABASE_ERROR', message);
  }
}

class TransactionUnavailableError extends ApiError {
  constructor(message = 'El servidor MongoDB no admite transacciones; la operación no se ejecutó') {
    super(503, 'TRANSACTIONS_UNAVAILABLE', message);
  }
}

class InternalServerError extends ApiError {
  constructor(message = 'Error interno del servidor') {
    super(500, 'INTERNAL_SERVER_ERROR', message);
  }
}

module.exports = {
  ApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  TransactionUnavailableError,
  InternalServerError,
};
