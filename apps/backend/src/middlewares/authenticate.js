'use strict';

const jwt = require('jsonwebtoken');
const User = require('../modules/users/model');
const env = require('../config/env');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');

/**
 * Autenticación obligatoria por Bearer token (access token JWT).
 * Verifica firma + expiración, carga el usuario (debe estar activo) y su
 * rol poblado. Adjunta req.user con companyId y permisos del rol.
 * El companyId resultante es SIEMPRE el del usuario autenticado:
 * la petición nunca decide a qué empresa pertenece.
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new AuthenticationError('Token de acceso requerido');
    }

    let payload;
    try {
      payload = jwt.verify(token, env.jwt.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AuthenticationError('Sesión expirada: renueve el access token con POST /auth/refresh');
      }
      throw new AuthenticationError('Token inválido');
    }

    const user = await User.findById(payload.sub).populate('roleId');
    if (!user || user.status !== 'active') {
      throw new AuthenticationError('Usuario inexistente o desactivado');
    }
    if (!user.roleId || !user.roleId._id) {
      throw new AuthorizationError('El usuario no tiene un rol asignado');
    }

    req.user = {
      id: String(user._id),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      companyId: String(user.companyId),
      role: {
        id: String(user.roleId._id),
        name: user.roleId.name,
        permissions: user.roleId.permissions || [],
      },
    };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate };
