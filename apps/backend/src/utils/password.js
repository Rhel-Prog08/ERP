'use strict';

const { ValidationError } = require('./errors');

const PASSWORD_MIN = 8;

/**
 * Regla de fuerza de contraseña (común para login de usuarios y cambio):
 * mínimo 8 caracteres, al menos una letra y un número.
 */
function assertPasswordStrength(password, field = 'password') {
  const errors = [];
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
    errors.push({ field, message: `Mínimo ${PASSWORD_MIN} caracteres` });
  } else {
    if (!/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(password)) {
      errors.push({ field, message: 'Debe contener al menos una letra' });
    }
    if (!/[0-9]/.test(password)) {
      errors.push({ field, message: 'Debe contener al menos un número' });
    }
  }
  if (errors.length > 0) {
    throw new ValidationError('Contraseña no válida', errors);
  }
}

module.exports = { assertPasswordStrength, PASSWORD_MIN };
