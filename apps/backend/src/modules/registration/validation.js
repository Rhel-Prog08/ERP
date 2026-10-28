'use strict';

const { validate } = require('../../utils/validate');
const { INVITATION_STATUSES } = require('./model');

/** POST /users/invitations — el invitador elige rol (de SU empresa). */
const invitationCreateSchema = {
  email: { required: true, type: 'email' },
  firstName: { required: true, type: 'string', minLength: 1, maxLength: 60 },
  lastName: { required: true, type: 'string', minLength: 1, maxLength: 60 },
  roleId: { required: true, type: 'objectId' },
};

/** GET /users/invitations */
const invitationListSchema = {
  page: { type: 'integer', min: 1 },
  limit: { type: 'integer', min: 1, max: 100 },
  sort: { type: 'string', maxLength: 40 },
  status: { type: 'enum', enum: INVITATION_STATUSES },
};

/** POST /auth/register — alta con invitación (público, rate-limited). */
const registerSchema = {
  inviteToken: { required: true, type: 'string', minLength: 16, maxLength: 256 },
  firstName: { required: true, type: 'string', minLength: 1, maxLength: 60 },
  lastName: { required: true, type: 'string', minLength: 1, maxLength: 60 },
  email: { required: true, type: 'email' },
  password: { required: true, type: 'string', minLength: 8, maxLength: 128 },
  passwordConfirm: { required: true, type: 'string', minLength: 8, maxLength: 128 },
};

/**
 * POST /auth/register-company — registro público MULTIEMPRESA (sin invitación).
 * El cliente envía SÓLO datos de su futura empresa y sus datos personales:
 * companyId/roleId/permissions/status ni siquiera se declaran (whitelist del
 * validador los descarta) — el rol Administrador lo asigna el servidor.
 */
const registerCompanySchema = {
  companyName: { required: true, type: 'string', minLength: 2, maxLength: 120 },
  firstName: { required: true, type: 'string', minLength: 1, maxLength: 60 },
  lastName: { required: true, type: 'string', minLength: 1, maxLength: 60 },
  email: { required: true, type: 'email' },
  password: { required: true, type: 'string', minLength: 8, maxLength: 128 },
  passwordConfirm: { required: true, type: 'string', minLength: 8, maxLength: 128 },
};

/** POST /auth/verify-email */
const verifyEmailSchema = {
  token: { required: true, type: 'string', minLength: 16, maxLength: 256 },
};

/** POST /auth/resend-verification */
const resendVerificationSchema = {
  email: { required: true, type: 'email' },
};

/** POST /users/invitations/resend — email opcional + rol para crear nueva. */
const invitationResendSchema = {
  email: { required: true, type: 'email' },
  firstName: { type: 'string', minLength: 1, maxLength: 60 },
  lastName: { type: 'string', minLength: 1, maxLength: 60 },
  roleId: { type: 'objectId' },
};

module.exports = {
  invitationListSchema,
  validateInvitationCreate: validate(invitationCreateSchema),
  validateInvitationList: validate(invitationListSchema),
  validateInvitationResend: validate(invitationResendSchema),
  validateRegister: validate(registerSchema),
  validatePublicRegister: validate(registerCompanySchema),
  validateVerifyEmail: validate(verifyEmailSchema),
  validateResendVerification: validate(resendVerificationSchema),
};
