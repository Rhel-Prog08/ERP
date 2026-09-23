'use strict';

const { validate } = require('../../utils/validate');

/** POST /auth/login */
const loginSchema = {
  email: { required: true, type: 'email' },
  password: { required: true, type: 'string', minLength: 1, maxLength: 128 },
};

/** POST /auth/refresh */
const refreshSchema = {
  refreshToken: { required: true, type: 'string', minLength: 16, maxLength: 256 },
};

/** POST /auth/logout — el refresh token es opcional (idempotente). */
const logoutSchema = {
  refreshToken: { type: 'string', minLength: 16, maxLength: 256 },
};

/** POST /auth/change-password */
const changePasswordSchema = {
  currentPassword: { required: true, type: 'string', minLength: 1, maxLength: 128 },
  newPassword: { required: true, type: 'string', minLength: 8, maxLength: 128 },
};

module.exports = {
  validateLogin: validate(loginSchema),
  validateRefresh: validate(refreshSchema),
  validateLogout: validate(logoutSchema),
  validateChangePassword: validate(changePasswordSchema),
};
