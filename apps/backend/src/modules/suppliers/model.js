'use strict';

const { Schema, model } = require('mongoose');
const { STATUSES } = require('../../config/constants');

/**
 * suppliers — proveedores por empresa. Código humano (PR-00001) único
 * por companyId. Baja lógica mediante status = inactive.
 */
const supplierSchema = new Schema(
  {
    supplierCode: { type: String, required: true, trim: true, maxlength: 20 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    companyName: { type: String, trim: true, maxlength: 160 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    // Teléfono MX: String de exactamente 10 dígitos. La restricción sólo se
    // aplica cuando el campo se modifica para no bloquear la edición de
    // documentos creados antes de la regla (migración: scripts/audit-contact-data.js).
    phone: {
      type: String,
      trim: true,
      maxlength: 40,
      validate: {
        validator(v) {
          if (!this.isModified('phone')) return true;
          return !v || /^[0-9]{10}$/.test(v);
        },
        message: 'El teléfono debe contener exactamente 10 dígitos (0-9)',
      },
    },
    address: { type: String, trim: true, maxlength: 240 },
    status: { type: String, enum: STATUSES, default: 'active' },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  },
  { timestamps: true }
);

supplierSchema.index({ companyId: 1, supplierCode: 1 }, { unique: true });
supplierSchema.index({ companyId: 1, name: 1 });
supplierSchema.index({ companyId: 1, status: 1 });

module.exports = model('Supplier', supplierSchema);
