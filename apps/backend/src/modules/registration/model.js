'use strict';

const { Schema, model } = require('mongoose');

const INVITATION_STATUSES = ['pending', 'used', 'revoked'];

/**
 * registrationInvitations — invitaciones para crear cuentas (FASE 3).
 *
 * - El rol y la empresa los elige QUIEN INVITA (nunca quien se registra):
 *   no puede autoasignarse roles privilegiados ni entrar en otra empresa.
 * - El token SÓLO se guarda como hash SHA-256 (select:false y oculto en
 *   toJSON); el valor en claro sólo viaja por el correo de invitación.
 * - `used` = consumida por un registro; `revoked` = cancelada por un
 *   administrador. No se borran documentos: sólo cambia el estado.
 */
const invitationSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 160 },
    firstName: { type: String, required: true, trim: true, maxlength: 60 },
    lastName: { type: String, required: true, trim: true, maxlength: 60 },
    roleId: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    usedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: INVITATION_STATUSES, default: 'pending' },
  },
  { timestamps: true }
);

invitationSchema.index({ companyId: 1, status: 1 });
invitationSchema.index({ email: 1, status: 1 });

/** Nunca exponer el hash del token. */
invitationSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.tokenHash;
    return ret;
  },
});

module.exports = model('RegistrationInvitation', invitationSchema);
module.exports.INVITATION_STATUSES = INVITATION_STATUSES;
