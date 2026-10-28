'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../users/model');
const env = require('../../config/env');
const { withTransaction } = require('../../config/db');
const {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  ConflictError,
  ApiError,
  MailError,
} = require('../../utils/errors');
const { durationToSeconds, expiryFromNow } = require('../../utils/duration');
const { assertPasswordStrength } = require('../../utils/password');
const { recordAudit, requestMeta } = require('../audit/service');
const { generateToken, hashToken } = require('../../utils/tokens');
const { sendPasswordResetMail } = require('../../utils/mailer');

/** Máximo de sesiones refresh simultáneas por usuario. */
const MAX_REFRESH_TOKENS = 5;

/**
 * Caducidad del token de restablecimiento de contraseña.
 * Se lee de env en cada llamada para permitir cambios sin reiniciar.
 */
function passwordResetTtlMs() {
  return env.registration.passwordResetTtlMinutes * 60 * 1000;
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      companyId: String(user.companyId),
      roleId: String(user.roleId && user.roleId._id ? user.roleId._id : user.roleId),
      roleVersion: user.roleId.authorizationVersion,
      passwordVersion: user.passwordVersion || 0,
    },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
}

/** Serializa el usuario para respuestas (sin datos sensibles). */
function serializeUser(user) {
  const role = user.roleId && user.roleId._id ? user.roleId : null;
  const company = user.companyId && user.companyId._id ? user.companyId : null;
  return {
    id: String(user._id),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    status: user.status,
    // true para cuentas legacy/administrativas; sólo cuentas de registro
    // público sin confirmar devuelven false.
    emailVerified: !user.verificationRequired || Boolean(user.emailVerifiedAt),
    company: company
      ? { id: String(company._id), name: company.name }
      : { id: String(user.companyId), name: '' },
    role: role
      ? { id: String(role._id), name: role.name, permissions: role.permissions || [] }
      : null,
  };
}

/** Genera refresh token aleatorio, guarda SOLO su hash y rota el resto. */
function appendRefreshToken(user, now = new Date()) {
  const alive = (user.refreshTokens || []).filter((t) => t.expiresAt > now);
  const refreshToken = crypto.randomBytes(48).toString('hex');
  alive.push({
    tokenHash: sha256(refreshToken),
    expiresAt: expiryFromNow(env.refresh.expiresIn),
    createdAt: now,
  });
  while (alive.length > MAX_REFRESH_TOKENS) alive.shift();
  user.refreshTokens = alive;
  return refreshToken;
}

const POPULATE = [
  { path: 'roleId' },
  { path: 'companyId', select: 'name legalName' },
];

/**
 * FLUJO A — login:
 * validación → bloqueo por intentos → hash bcrypt → JWT + refresh rotado
 * → auditoría LOGIN.
 */
async function login({ email, password }, req) {
  const user = await User.findOne({ email: String(email).toLowerCase() })
    .select('+password +failedLoginAttempts +lockUntil +refreshTokens')
    .populate(POPULATE);

  const meta = requestMeta(req);

  // Cuenta inexistente: mismo mensaje que contraseña errónea (sin enumerar usuarios).
  if (!user) {
    throw new AuthenticationError('Credenciales inválidas');
  }

  if (user.isLocked()) {
    throw new AuthenticationError(
      `Cuenta bloqueada por intentos fallidos. Intente de nuevo en ${env.security.lockoutMinutes} minuto(s).`
    );
  }

  const validPassword = await user.comparePassword(password);
  if (!validPassword) {
    const attempts = (user.failedLoginAttempts || 0) + 1;
    user.failedLoginAttempts = attempts;
    if (attempts >= env.security.maxLoginAttempts) {
      user.lockUntil = new Date(Date.now() + env.security.lockoutMinutes * 60 * 1000);
    }
    await user.save();
    await recordAudit({
      userId: user._id,
      companyId: user.companyId,
      action: 'LOGIN_FAILED',
      module: 'auth',
      entity: 'user',
      entityId: user._id,
      description: `Intento fallido ${attempts}/${env.security.maxLoginAttempts}`,
      ...meta,
    });
    throw new AuthenticationError('Credenciales inválidas');
  }

  if (user.status !== 'active') {
    await recordAudit({
      userId: user._id,
      companyId: user.companyId,
      action: 'LOGIN_FAILED',
      module: 'auth',
      entity: 'user',
      entityId: user._id,
      description: 'Cuenta desactivada',
      ...meta,
    });
    throw new AuthenticationError('Cuenta desactivada');
  }

  // Cuenta nueva de registro público sin verificar: se bloquea el acceso
  // DESPUÉS de validar la contraseña (sin enumerar usuarios ni filtrar el
  // estado a terceros que no conozcan la clave). Las cuentas existentes
  // (verificationRequired=false) siguen funcionando sin cambios.
  if (user.verificationRequired && !user.emailVerifiedAt) {
    await recordAudit({
      userId: user._id,
      companyId: user.companyId,
      action: 'LOGIN_FAILED',
      module: 'auth',
      entity: 'user',
      entityId: user._id,
      description: 'Acceso denegado: correo electrónico sin verificar',
      ...meta,
    });
    throw new AuthenticationError(
      'La cuenta está pendiente de verificar el correo electrónico. Revise su bandeja para activarla.'
    );
  }

  if (!user.roleId || !user.roleId._id) {
    throw new AuthorizationError('El usuario no tiene un rol asignado');
  }
  if (user.roleId.status !== 'active') {
    throw new AuthenticationError('El rol asignado está desactivado');
  }
  if (String(user.roleId.companyId) !== String(user.companyId._id || user.companyId)) {
    throw new AuthorizationError('El rol no pertenece a la empresa del usuario');
  }

  // Éxito → reiniciar contadores y emitir tokens.
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  user.lastLoginAt = new Date();
  const refreshToken = appendRefreshToken(user);
  await user.save();

  await recordAudit({
    userId: user._id,
    companyId: user.companyId,
    action: 'LOGIN',
    module: 'auth',
    entity: 'user',
    entityId: user._id,
    description: 'Inicio de sesión',
    ...meta,
  });

  return {
    user: serializeUser(user),
    accessToken: signAccessToken(user),
    refreshToken,
    expiresIn: durationToSeconds(env.jwt.expiresIn),
  };
}

/** REFRESH con rotación: el token usado se elimina y se emite uno nuevo. */
async function refresh({ refreshToken }, req) {
  const tokenHash = sha256(refreshToken);
  const user = await User.findOne({ 'refreshTokens.tokenHash': tokenHash })
    .select('+refreshTokens +lockUntil')
    .populate(POPULATE);

  const invalid = new AuthenticationError('Refresh token inválido o expirado');
  if (!user || user.status !== 'active' || user.isLocked()) throw invalid;
  if (
    !user.roleId ||
    !user.roleId._id ||
    user.roleId.status !== 'active' ||
    String(user.roleId.companyId) !== String(user.companyId._id || user.companyId)
  ) {
    throw invalid;
  }

  const stored = user.refreshTokens.find((t) => t.tokenHash === tokenHash);
  if (!stored || stored.expiresAt.getTime() < Date.now()) throw invalid;

  // Rotación.
  user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== tokenHash);
  const newRefreshToken = appendRefreshToken(user);
  await user.save();

  return {
    user: serializeUser(user),
    accessToken: signAccessToken(user),
    refreshToken: newRefreshToken,
    expiresIn: durationToSeconds(env.jwt.expiresIn),
  };
}

/** LOGOUT: elimina el refresh token usado (idempotente). */
async function logout({ refreshToken }, req) {
  const meta = requestMeta(req);
  if (refreshToken) {
    const tokenHash = sha256(refreshToken);
    const user = await User.findOne({ 'refreshTokens.tokenHash': tokenHash }).select('+refreshTokens');
    if (user) {
      user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== tokenHash);
      await user.save();
      await recordAudit({
        userId: user._id,
        companyId: user.companyId,
        action: 'LOGOUT',
        module: 'auth',
        entity: 'user',
        entityId: user._id,
        description: 'Cierre de sesión',
        ...meta,
      });
    }
  }
  return { message: 'Sesión cerrada' };
}

/** Cambio de contraseña: invalida TODOS los refresh tokens del usuario. */
async function changePassword({ actor, currentPassword, newPassword }, req) {
  const user = await User.findById(actor.id).select('+password +refreshTokens');
  if (!user) throw new AuthenticationError('Usuario no encontrado');

  const currentOk = await user.comparePassword(currentPassword);
  if (!currentOk) {
    throw new ValidationError('La contraseña actual no coincide', [
      { field: 'currentPassword', message: 'No coincide con la contraseña actual' },
    ]);
  }
  assertPasswordStrength(newPassword, 'newPassword');
  if (newPassword === currentPassword) {
    throw new ValidationError('La nueva contraseña debe ser distinta de la actual', [
      { field: 'newPassword', message: 'Debe ser distinta a la actual' },
    ]);
  }

  user.password = newPassword; // hash en pre('save')
  user.refreshTokens = [];     // cierra el resto de sesiones
  await user.save();

  await recordAudit({
    userId: user._id,
    companyId: user.companyId,
    action: 'CHANGE_PASSWORD',
    module: 'auth',
    entity: 'user',
    entityId: user._id,
    description: 'Cambio de contraseña propio',
    ...requestMeta(req),
  });

  return { message: 'Contraseña actualizada. Las demás sesiones se han cerrado.' };
}

/**
 * FLUJO C — solicitud de restablecimiento (POST /auth/forgot-password):
 *  - respuesta genérica (no enumera cuentas);
 *  - token criptográfico de 32 bytes, sólo su hash en BD;
 *  - expiración 30 min, cooldown por correo;
 *  - envío honesto: fallo de correo → MailError (502), sin fingir envío.
 */
async function forgotPassword({ email }, req) {
  const normalizedEmail = String(email).toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail }).select(
    '_id email firstName status passwordResetToken'
  );
  if (!user || user.status !== 'active') {
    // Respuesta genérica: sin distinguir si el correo existe o la cuenta está inactiva.
    return { message: 'Si el correo pertenece a una cuenta activa, recibirá un mensaje con el enlace de restablecimiento.' };
  }

  const now = Date.now();
  const prt = user.passwordResetToken;
  if (prt && prt.sentAt && now - new Date(prt.sentAt).getTime() < (env.registration.passwordResetCooldownSeconds || 120) * 1000) {
    // Cooldown por cuenta: respuesta genérica, sin enviar nada nuevo.
    return { message: 'Si el correo pertenece a una cuenta activa, recibirá un mensaje con el enlace de restablecimiento.' };
  }

  const token = generateToken();
  user.passwordResetToken = {
    tokenHash: hashToken(token),
    expiresAt: new Date(now + passwordResetTtlMs()),
    sentAt: new Date(now),
    usedAt: null,
  };
  await user.save();

  try {
    await sendPasswordResetMail({
      to: normalizedEmail,
      firstName: user.firstName,
      token,
      ttlMinutes: env.registration.passwordResetTtlMinutes,
    });
  } catch (err) {
    // El proveedor de correo falló: no se afirma entrega. El token queda en BD
    // (hash) y el usuario puede reintentar tras el cooldown.
    throw new MailError('No se pudo enviar el correo de restablecimiento; inténtelo nuevamente.');
  }

  await recordAudit({
    userId: user._id,
    companyId: user.companyId,
    action: 'FORGOT_PASSWORD',
    module: 'auth',
    entity: 'user',
    entityId: user._id,
    description: 'Solicitud de restablecimiento de contraseña',
    ...requestMeta(req),
  });

  return { message: 'Si el correo pertenece a una cuenta activa, recibirá un mensaje con el enlace de restablecimiento.' };
}

/**
 * FLUJO C — restablecimiento de contraseña (POST /auth/reset-password):
 *  - verifica hash, vencimiento y estado de uso del token;
 *  - aplica política de contraseñas;
 *  - consume el token de forma atómica (una sola vez);
 *  - invalida refresh tokens e incrementa passwordVersion (revoca JWTs previos);
 *  - todo en transacción cuando sea posible.
 */
async function resetPassword({ token, newPassword }, req) {
  assertPasswordStrength(newPassword, 'newPassword');

  const user = await User.findOne({ 'passwordResetToken.tokenHash': hashToken(token) }).select(
    '+password +passwordResetToken +refreshTokens'
  );

  const prt = user && user.passwordResetToken;
  if (
    !user ||
    !prt ||
    !prt.tokenHash ||
    prt.usedAt ||
    prt.expiresAt.getTime() < Date.now()
  ) {
    throw new ValidationError('El token de restablecimiento no es válido o ha caducado');
  }

  const now = Date.now();
  const result = await withTransaction(async (session) => {
    const opts = session ? { session } : {};

    // Re-leer dentro de la transacción para detectar uso concurrente.
    const current = await User.findById(user._id).select(
      '+password +passwordResetToken +refreshTokens'
    ).session(session);
    if (!current) throw new ValidationError('El token de restablecimiento no es válido o ha caducado');
    const currentPrt = current.passwordResetToken;
    if (
      !currentPrt ||
      !currentPrt.tokenHash ||
      currentPrt.usedAt ||
      currentPrt.expiresAt.getTime() < Date.now()
    ) {
      throw new ValidationError('El token de restablecimiento no es válido o ha caducado');
    }

    // Consumir el token (único uso) antes de cambiar la contraseña.
    currentPrt.usedAt = new Date(now);

    current.password = newPassword; // hash en pre('save')
    current.refreshTokens = [];     // revoca todas las sesiones (refresh tokens)
    current.passwordVersion = (current.passwordVersion || 0) + 1; // invalida JWTs previos
    await current.save(opts);

    await recordAudit({
      userId: current._id,
      companyId: current.companyId,
      action: 'RESET_PASSWORD',
      module: 'auth',
      entity: 'user',
      entityId: current._id,
      description: 'Contraseña restablecida por token',
      ...requestMeta(req),
    }, { session, strict: Boolean(session) });

    return current;
  });

  return { message: 'Contraseña actualizada correctamente. Todas las sesiones se han cerrado.' };
}

/** Perfil del usuario autenticado (para arrancar la UI con sus permisos). */
async function getMe(actor) {
  const user = await User.findById(actor.id).populate(POPULATE);
  if (!user || user.status !== 'active') {
    throw new AuthenticationError('Usuario inexistente o desactivado');
  }
  return serializeUser(user);
}

module.exports = { login, refresh, logout, changePassword, forgotPassword, resetPassword, getMe, serializeUser };
