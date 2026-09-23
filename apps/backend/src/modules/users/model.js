'use strict';

const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');
const { STATUSES } = require('../../config/constants');

/**
 * users — usuario autenticado. SIEMPRE pertenece a una empresa (companyId).
 * - password: hash bcrypt, nunca en texto plano, select:false.
 * - refreshTokens: hash SHA-256 de refresh tokens vigentes (rotación).
 * - failedLoginAttempts / lockUntil: bloqueo temporal por intentos fallidos.
 * Email ÚNICAMENTE global (login sin empresa): una persona = una cuenta.
 */
const userSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 60 },
    lastName: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
    password: { type: String, required: true, select: false, minlength: 8, maxlength: 128 },
    roleId: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    status: { type: String, enum: STATUSES, default: 'active' },
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, default: null, select: false },
    refreshTokens: {
      type: [
        {
          tokenHash: { type: String, required: true },
          expiresAt: { type: Date, required: true },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
      select: false,
    },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ companyId: 1, status: 1 });
userSchema.index({ companyId: 1, roleId: 1 });

// Hash automático al guardar si la contraseña cambió.
userSchema.pre('save', async function preSave(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockUntil) && this.lockUntil.getTime() > Date.now();
};

/** Nunca exponer hash ni tokens en respuestas. */
userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.password;
    delete ret.refreshTokens;
    delete ret.failedLoginAttempts;
    delete ret.lockUntil;
    return ret;
  },
});

module.exports = model('User', userSchema);
