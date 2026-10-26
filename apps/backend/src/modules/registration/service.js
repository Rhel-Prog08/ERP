'use strict';

/**
 * Servicio de registro controlado + verificación de correo (FASE 3/4).
 *
 * Garantías:
 *  - El registro público SÓLO es posible con una invitación válida; rol y
 *    empresa los decide el invitador (sin autoasignación de privilegios).
 *  - Tokens opacos de 32 bytes: en BD sólo vive su hash SHA-256; jamás se
 *    imprimen en logs ni en respuestas.
 *  - Verificación de un solo uso con caducidad (30 min por defecto).
 *  - Las respuestas de reenvío son genéricas (sin enumerar usuarios).
 *  - Todo evento relevante se audita en auditLogs.
 */

const env = require('../../config/env');
const { DEFAULT_ROLES, ROLE_PERMISSIONS } = require('../../config/constants');
const User = require('../users/model');
const Role = require('../roles/model');
const Company = require('../companies/model');
const Warehouse = require('../warehouses/model');
const settingsService = require('../settings/service');
const Invitation = require('./model');
const { withTransaction } = require('../../config/db');
const { ValidationError, ConflictError, NotFoundError, ApiError } = require('../../utils/errors');
const { generateToken, hashToken } = require('../../utils/tokens');
const { assertPasswordStrength } = require('../../utils/password');
const { getPagination, getSort, paginated } = require('../../utils/pagination');
const { sendVerificationMail, sendInvitationMail } = require('../../utils/mailer');
const { recordAudit, requestMeta } = require('../audit/service');

/** Mensaje único y genérico del reenvío (no revela si el correo existe). */
const RESEND_GENERIC_MESSAGE =
  'Si el correo pertenece a una cuenta pendiente de verificación, ' +
  'recibirá un mensaje con el enlace. Si acaba de solicitarlo, espere unos minutos.';

function assertRegistrationEnabled() {
  if (env.registration.enabled) return;
  throw new ApiError(
    503,
    'REGISTRATION_DISABLED',
    'El registro de cuentas no está habilitado en este momento.'
  );
}

/* ------------------------------------------------------------------ *
 * Invitaciones (módulo Users, permisos users.*)                       *
 * ------------------------------------------------------------------ */

/** POST /users/invitations — crea la invitación y envía el correo. */
async function createInvitation(actor, body, req) {
  const email = String(body.email).toLowerCase();

  // El rol debe existir y pertenecer a la MISMA empresa del invitador:
  // la cuenta queda atada a una empresa autorizada sin opción de elegir.
  const role = await Role.findOne({ _id: body.roleId, companyId: actor.companyId }).lean();
  if (!role) throw new ValidationError('El rol indicado no existe en tu empresa');

  const existingUser = await User.findOne({ email }).select('_id').lean();
  if (existingUser) throw new ConflictError('Ese correo ya está registrado');

  const activeInvite = await Invitation.findOne({
    email,
    companyId: actor.companyId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  })
    .select('_id')
    .lean();
  if (activeInvite) {
    throw new ConflictError('Ya existe una invitación pendiente para ese correo');
  }

  // req.user (authenticate) expone `id` como string; se tolera también `_id`
  // por si el llamador pasa un documento mongoose (tests/servicios).
  const invitedById = actor.id || actor._id;

  const token = generateToken();
  const invitation = await Invitation.create({
    email,
    firstName: body.firstName,
    lastName: body.lastName,
    roleId: role._id,
    companyId: actor.companyId,
    invitedBy: invitedById,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + env.registration.invitationTtlDays * 24 * 60 * 60 * 1000),
    status: 'pending',
  });

  try {
    await sendInvitationMail({
      to: email,
      firstName: body.firstName,
      token,
      inviterName: `${actor.firstName} ${actor.lastName}`.trim(),
    });
  } catch (err) {
    // El correo falló: se revoca la invitación recién creada para no dejar
    // un registro "pending" inutilizable que bloquearía crear otra; el
    // administrador ve el error real (502) sin fingir envío y puede reintentar.
    invitation.status = 'revoked';
    await invitation.save();
    throw err;
  }

  await recordAudit({
    userId: invitedById,
    companyId: actor.companyId,
    action: 'CREATE_INVITATION',
    module: 'users',
    entity: 'invitation',
    entityId: String(invitation._id),
    newValue: { email, roleId: String(role._id), expiresAt: invitation.expiresAt },
    description: `Invitación creada para ${email}`,
    ...requestMeta(req),
  });

  return invitation;
}

/** GET /users/invitations — listado de invitaciones de la empresa. */
async function listInvitations(actor, query = {}) {
  const { page, limit, skip } = getPagination(query);
  const sort = getSort(query, ['email', 'status', 'createdAt', 'expiresAt'], '-createdAt');

  const filter = { companyId: actor.companyId };
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    Invitation.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Invitation.countDocuments(filter),
  ]);
  return paginated(items, { page, limit }, total);
}

/** DELETE /users/invitations/:id — revoca una invitación pendiente. */
async function revokeInvitation(actor, id, req) {
  const invitation = await Invitation.findOne({ _id: id, companyId: actor.companyId });
  if (!invitation) throw new NotFoundError('Invitación no encontrada');
  if (invitation.status !== 'pending') {
    throw new ValidationError('Sólo pueden revocarse invitaciones pendientes');
  }

  invitation.status = 'revoked';
  await invitation.save();

  await recordAudit({
    userId: actor.id || actor._id,
    companyId: actor.companyId,
    action: 'REVOKE_INVITATION',
    module: 'users',
    entity: 'invitation',
    entityId: String(invitation._id),
    previousValue: { status: 'pending' },
    newValue: { status: 'revoked' },
    description: `Invitación revocada (${invitation.email})`,
    ...requestMeta(req),
  });

  return invitation;
}

/* ------------------------------------------------------------------ *
 * Registro público (POST /auth/register)                              *
 * ------------------------------------------------------------------ */

async function register({ inviteToken, firstName, lastName, email, password, passwordConfirm }, req) {
  assertRegistrationEnabled();

  if (password !== passwordConfirm) {
    throw new ValidationError('Las contraseñas no coinciden', [
      { field: 'passwordConfirm', message: 'Las contraseñas no coinciden' },
    ]);
  }
  assertPasswordStrength(password);

  const normalizedEmail = String(email).toLowerCase();
  const invitation = await Invitation.findOne({ tokenHash: hashToken(inviteToken) }).select(
    '+tokenHash'
  );

  // Respuesta genérica: un token inválido/expirado/revocado/ya usado no se
  // distingue (sin convertir el endpoint en un oráculo).
  if (
    !invitation ||
    invitation.status !== 'pending' ||
    invitation.expiresAt.getTime() < Date.now()
  ) {
    throw new ValidationError('La invitación no es válida o ha caducado');
  }

  if (invitation.email !== normalizedEmail) {
    throw new ValidationError('El correo no coincide con el de la invitación', [
      { field: 'email', message: 'Use exactamente el correo con el que fue invitado' },
    ]);
  }

  const duplicated = await User.findOne({ email: normalizedEmail }).select('_id').lean();
  if (duplicated) throw new ConflictError('Ese correo ya está registrado. Inicie sesión.');

  // Usuario + consumo de la invitación de forma atómica.
  const user = await withTransaction(async (session) => {
    const [created] = await User.create(
      [
        {
          firstName,
          lastName,
          email: normalizedEmail,
          password,
          roleId: invitation.roleId,
          companyId: invitation.companyId,
          status: 'active',
          // Sólo el registro público queda pendiente de verificar; las
          // cuentas existentes y las creadas por administrador no.
          verificationRequired: true,
          emailVerifiedAt: null,
        },
      ],
      { session }
    );

    invitation.status = 'used';
    invitation.usedAt = new Date();
    invitation.usedBy = created._id;
    await invitation.save({ session });

    return created;
  });

  // Token de verificación: 30 min, hash en BD, un solo uso.
  const verificationToken = generateToken();
  user.emailVerification = {
    tokenHash: hashToken(verificationToken),
    expiresAt: new Date(Date.now() + env.registration.verificationTtlMinutes * 60 * 1000),
    sentAt: new Date(),
  };
  await user.save();

  await recordAudit({
    userId: user._id,
    companyId: user.companyId,
    action: 'REGISTER',
    module: 'auth',
    entity: 'user',
    entityId: String(user._id),
    description: 'Alta por registro público con invitación',
    ...requestMeta(req),
  });

  // El envío se intenta DESPUÉS del alta; si falla se informa con honestidad
  // (emailSent=false) para que el usuario use "reenviar", sin fingir envío.
  let emailSent = true;
  try {
    await sendVerificationMail({
      to: normalizedEmail,
      firstName,
      token: verificationToken,
      ttlMinutes: env.registration.verificationTtlMinutes,
    });
  } catch {
    emailSent = false;
  }

  return {
    user: {
      id: String(user._id),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },
    emailSent,
    message: emailSent
      ? 'Cuenta creada. Revise su correo para verificarla antes de iniciar sesión.'
      : 'Cuenta creada, pero el correo de verificación no pudo enviarse. Use "Reenviar verificación".',
  };
}

/* ------------------------------------------------------------------ *
 * Registro público MULTIEMPRESA (POST /auth/register-company)         *
 * ------------------------------------------------------------------ */

/**
 * Crea una empresa nueva y a su administrador en UNA transacción, con el
 * mismo aprovisionamiento que POST /companies (almacén, settings y los 6
 * roles por defecto). Garantías:
 *  - Nada del cliente es autoridad: companyId/roleId/permissions/status no
 *    se declaran en el esquema (whitelist) y el rol Administrador se toma
 *    del rol recién creado DENTRO de la transacción.
 *  - Sin administradores huérfanos ni empresas a medio aprovisionar: si
 *    cualquier paso falla, todo se revierte (y el índice único de email
 *    convierte las carreras duplicadas en 409).
 *  - La cuenta nace bloqueada hasta verificar el correo (verificationRequired):
 *    como es la ÚNICA cuenta de la empresa, nadie puede abrir sesión ni ver
 *    datos de esa empresa hasta completar la verificación.
 */
async function registerCompany(
  { companyName, firstName, lastName, email, password, passwordConfirm },
  req
) {
  assertRegistrationEnabled();

  if (password !== passwordConfirm) {
    throw new ValidationError('Las contraseñas no coinciden', [
      { field: 'passwordConfirm', message: 'Las contraseñas no coinciden' },
    ]);
  }
  assertPasswordStrength(password);

  const normalizedEmail = String(email).toLowerCase();
  const companyCleanName = String(companyName).trim();

  const duplicated = await User.findOne({ email: normalizedEmail }).select('_id').lean();
  if (duplicated) {
    throw new ConflictError(
      'Ese correo ya está registrado. Si es una cuenta pendiente de verificación, use "Reenviar verificación".'
    );
  }

  let result;
  try {
    result = await withTransaction(async (session) => {
      const opts = session ? { session } : {};

      // 1) Empresa mínima: nombre + correo de contacto (el resto lo completa
      //    el administrador tras verificar). Siempre 'active'; el candado
      //    real es la verificación de su única cuenta.
      const [company] = await Company.create(
        [{ name: companyCleanName, email: normalizedEmail, status: 'active' }],
        opts
      );

      // 2) Aprovisionamiento idéntico al de POST /companies.
      await Warehouse.create(
        [{ name: 'Almacén Principal', branchId: null, companyId: company._id, status: 'active' }],
        opts
      );
      await settingsService.getForCompany(company._id, session);

      // 3) Los 6 roles por defecto; capturamos el _id del Administrador
      //    recién creado (NUNCA llega del cliente).
      let adminRoleId = null;
      for (const name of DEFAULT_ROLES) {
        const [role] = await Role.create(
          [
            {
              name,
              companyId: company._id,
              permissions: ROLE_PERMISSIONS[name],
              isSystem: true,
              status: 'active',
            },
          ],
          opts
        );
        if (name === 'Administrador') adminRoleId = role._id;
      }
      if (!adminRoleId) throw new ApiError(500, 'INTERNAL_ERROR', 'Rol Administrador no creado');

      // 4) El administrador de ESTA empresa, bloqueado hasta verificar.
      const [user] = await User.create(
        [
          {
            firstName,
            lastName,
            email: normalizedEmail,
            password,
            roleId: adminRoleId,
            companyId: company._id,
            status: 'active',
            verificationRequired: true,
            emailVerifiedAt: null,
          },
        ],
        opts
      );

      // 5) Auditoría atómica en la empresa nueva.
      await recordAudit(
        {
          userId: user._id,
          companyId: company._id,
          action: 'REGISTER_COMPANY',
          module: 'auth',
          entity: 'company',
          entityId: String(company._id),
          newValue: { name: company.name, adminEmail: normalizedEmail },
          description: `Registro público: empresa ${company.name} creada con su administrador`,
          ...requestMeta(req),
        },
        { session, strict: Boolean(session) }
      );

      return { user, company };
    });
  } catch (err) {
    // Carrera sobre el índice único de email u otra duplicidad: 409 claro.
    if (err && (err.code === 11000 || err.name === 'MongoServerError')) {
      throw new ConflictError('Ese correo ya está registrado.');
    }
    throw err;
  }

  const { user, company } = result;

  // Token de verificación: 30 min, sólo su hash en BD, un solo uso.
  const verificationToken = generateToken();
  user.emailVerification = {
    tokenHash: hashToken(verificationToken),
    expiresAt: new Date(Date.now() + env.registration.verificationTtlMinutes * 60 * 1000),
    sentAt: new Date(),
  };
  await user.save();

  // Envío honesto: si el correo falla, la cuenta SIGUE pendiente y el
  // cliente puede reintentar; jamás se presenta como activada.
  let emailSent = true;
  try {
    await sendVerificationMail({
      to: normalizedEmail,
      firstName,
      token: verificationToken,
      ttlMinutes: env.registration.verificationTtlMinutes,
    });
  } catch {
    emailSent = false;
  }

  return {
    company: { id: String(company._id), name: company.name },
    user: {
      id: String(user._id),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },
    emailSent,
    message: emailSent
      ? 'Empresa creada. Revise su correo para verificar la cuenta antes de iniciar sesión.'
      : 'Empresa creada, pero el correo de verificación no pudo enviarse. Use "Reenviar verificación".',
  };
}

/* ------------------------------------------------------------------ *
 * Verificación (POST /auth/verify-email)                              *
 * ------------------------------------------------------------------ */

async function verifyEmail({ token }, req) {
  const user = await User.findOne({ 'emailVerification.tokenHash': hashToken(token) }).select(
    '+emailVerification'
  );

  const ev = user && user.emailVerification;
  if (!ev || !ev.tokenHash) {
    throw new ValidationError('El enlace de verificación no es válido o ha caducado');
  }
  if (ev.usedAt) {
    // Un solo uso: el token ya fue consumido.
    throw new ValidationError('El enlace de verificación ya fue utilizado');
  }
  if (ev.expiresAt.getTime() < Date.now()) {
    throw new ValidationError('El enlace de verificación ha caducado. Solicite uno nuevo.');
  }

  user.emailVerifiedAt = new Date();
  user.emailVerification = null; // consumir el token
  await user.save();

  await recordAudit({
    userId: user._id,
    companyId: user.companyId,
    action: 'VERIFY_EMAIL',
    module: 'auth',
    entity: 'user',
    entityId: String(user._id),
    description: 'Correo electrónico verificado',
    ...requestMeta(req),
  });

  return { message: 'Correo verificado. Ya puede iniciar sesión.' };
}

/* ------------------------------------------------------------------ *
 * Reenvío (POST /auth/resend-verification)                            *
 * ------------------------------------------------------------------ */

async function resendVerification({ email }, req) {
  const normalizedEmail = String(email).toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select('+emailVerification');

  // Genérico y silencioso si no existe, ya fue verificada o no requiere
  // verificación: evita enumeración de usuarios.
  if (!user || !user.verificationRequired || user.emailVerifiedAt) {
    // Respuesta SIEMPRE idéntica (mensaje genérico, sin indicar si la cuenta
  // existe o si se envió algo): sin `sent` ni otro artefacto distinguible,
  // el endpoint no sirve de oráculo de enumeración de cuentas.
  return { message: RESEND_GENERIC_MESSAGE };
  }

  const now = Date.now();
  const lastSentAt = user.emailVerification && user.emailVerification.sentAt;
  if (lastSentAt && now - lastSentAt.getTime() < env.registration.resendCooldownSeconds * 1000) {
    // Enfriamiento por cuenta: no se envía nada y la respuesta no cambia.
    // Respuesta SIEMPRE idéntica (mensaje genérico, sin indicar si la cuenta
  // existe o si se envió algo): sin `sent` ni otro artefacto distinguible,
  // el endpoint no sirve de oráculo de enumeración de cuentas.
  return { message: RESEND_GENERIC_MESSAGE };
  }

  const token = generateToken();
  user.emailVerification = {
    tokenHash: hashToken(token),
    expiresAt: new Date(now + env.registration.verificationTtlMinutes * 60 * 1000),
    sentAt: new Date(now),
  };
  await user.save();

  try {
    await sendVerificationMail({
      to: normalizedEmail,
      firstName: user.firstName,
      token,
      ttlMinutes: env.registration.verificationTtlMinutes,
    });
  } catch {
    // Se responde igual (genérico); el administrador ve el problema en logs
    // del proveedor. Nunca se expone el estado del servicio al cliente.
    // Respuesta SIEMPRE idéntica (mensaje genérico, sin indicar si la cuenta
  // existe o si se envió algo): sin `sent` ni otro artefacto distinguible,
  // el endpoint no sirve de oráculo de enumeración de cuentas.
  return { message: RESEND_GENERIC_MESSAGE };
  }

  await recordAudit({
    userId: user._id,
    companyId: user.companyId,
    action: 'RESEND_VERIFICATION',
    module: 'auth',
    entity: 'user',
    entityId: String(user._id),
    description: 'Reenvío del correo de verificación',
    ...requestMeta(req),
  });

  return { message: RESEND_GENERIC_MESSAGE };
}

module.exports = {
  createInvitation,
  listInvitations,
  revokeInvitation,
  register,
  registerCompany,
  verifyEmail,
  resendVerification,
  RESEND_GENERIC_MESSAGE,
};
