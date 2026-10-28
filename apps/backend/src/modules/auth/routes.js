'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middlewares/authenticate');
const {
  authLimiter,
  registerLimiter,
  verifyLimiter,
  resendLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
} = require('../../middlewares/rateLimit');
const controller = require('./controller');
const { validateLogin, validateRefresh, validateLogout, validateChangePassword, validateForgotPassword, validateResetPassword } = require('./validation');
const {
  validateRegister,
  validatePublicRegister,
  validateVerifyEmail,
  validateResendVerification,
} = require('../registration/validation');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const registration = require('../registration/service');

// POST /api/v1/auth/login — rate limit + validación de entradas.
router.post('/login', authLimiter, validateLogin, controller.login);

// POST /api/v1/auth/register — registro público CON invitación (rate limit).
router.post(
  '/register',
  registerLimiter,
  validateRegister,
  asyncHandler(async (req, res) => {
    sendSuccess(res, await registration.register(req.body, req), 201);
  })
);

// POST /api/v1/auth/register-company — registro público MULTIEMPRESA:
// crea empresa + aprovisionamiento + administrador en una transacción.
// Mismo gate de configuración y mismo limiter que /register.
router.post(
  '/register-company',
  registerLimiter,
  validatePublicRegister,
  asyncHandler(async (req, res) => {
    sendSuccess(res, await registration.registerCompany(req.body, req), 201);
  })
);

// POST /api/v1/auth/verify-email — token de un solo uso (rate limit).
router.post(
  '/verify-email',
  verifyLimiter,
  validateVerifyEmail,
  asyncHandler(async (req, res) => {
    sendSuccess(res, await registration.verifyEmail(req.body, req));
  })
);

// POST /api/v1/auth/resend-verification — respuesta genérica (sin enumerar).
router.post(
  '/resend-verification',
  resendLimiter,
  validateResendVerification,
  asyncHandler(async (req, res) => {
    sendSuccess(res, await registration.resendVerification(req.body, req));
  })
);

// POST /api/v1/auth/refresh — rotación de refresh token.
router.post('/refresh', validateRefresh, controller.refresh);

// POST /api/v1/auth/logout — idempotente.
router.post('/logout', validateLogout, controller.logout);

// POST /api/v1/auth/change-password — requiere sesión activa.
router.post('/change-password', authenticate, validateChangePassword, controller.changePassword);

// POST /api/v1/auth/forgot-password — solicitud de restablecimiento (respuesta genérica).
router.post('/forgot-password', forgotPasswordLimiter, validateForgotPassword, controller.forgotPassword);

// POST /api/v1/auth/reset-password — restablecimiento con token de un solo uso.
router.post('/reset-password', resetPasswordLimiter, validateResetPassword, controller.resetPassword);

// GET /api/v1/auth/me — perfil + permisos del usuario autenticado.
router.get('/me', authenticate, controller.me);

module.exports = router;
