'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middlewares/authenticate');
const { authLimiter } = require('../../middlewares/rateLimit');
const controller = require('./controller');
const { validateLogin, validateRefresh, validateLogout, validateChangePassword } = require('./validation');

// POST /api/v1/auth/login — rate limit + validación de entradas.
router.post('/login', authLimiter, validateLogin, controller.login);

// POST /api/v1/auth/refresh — rotación de refresh token.
router.post('/refresh', validateRefresh, controller.refresh);

// POST /api/v1/auth/logout — idempotente.
router.post('/logout', validateLogout, controller.logout);

// POST /api/v1/auth/change-password — requiere sesión activa.
router.post('/change-password', authenticate, validateChangePassword, controller.changePassword);

// GET /api/v1/auth/me — perfil + permisos del usuario autenticado.
router.get('/me', authenticate, controller.me);

module.exports = router;
