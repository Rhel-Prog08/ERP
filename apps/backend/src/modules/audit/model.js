'use strict';

const { Schema, model } = require('mongoose');
const { AUDIT_ACTIONS } = require('../../config/constants');

/**
 * auditLogs — bitácora de solo lectura para usuarios normales.
 * No existe ningún endpoint que modifique o elimine estas entradas.
 */
const auditLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    action: { type: String, required: true, enum: AUDIT_ACTIONS },
    module: { type: String, required: true, maxlength: 40 },
    entity: { type: String, maxlength: 60 },
    entityId: { type: String, maxlength: 64 },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    description: { type: String, maxlength: 500 },
    ip: { type: String, maxlength: 60 },
    userAgent: { type: String, maxlength: 300 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    // Inmutable: ni siquiera a nivel de documento se puede reescribir.
    minimize: false,
  }
);

auditLogSchema.index({ companyId: 1, createdAt: -1 });
auditLogSchema.index({ companyId: 1, action: 1 });
auditLogSchema.index({ entity: 1, entityId: 1 });

// Bloquear escritura/eliminación desde cualquier sesión de aplicación.
auditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndDelete', 'deleteOne', 'deleteMany'], function () {
  throw new Error('auditLogs es de solo lectura');
});

module.exports = model('AuditLog', auditLogSchema);
