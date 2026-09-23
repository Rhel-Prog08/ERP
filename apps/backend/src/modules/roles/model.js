'use strict';

const { Schema, model } = require('mongoose');
const { STATUSES } = require('../../config/constants');

/**
 * roles — roles POR EMPRESA (multiempresa real): cada empresa tiene su
 * propio juego de los 6 roles, con permisos editables de forma aislada.
 * `permissions` guarda claves del catálogo global (users.read, ...).
 */
const roleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
    status: { type: String, enum: STATUSES, default: 'active' },
  },
  { timestamps: true }
);

roleSchema.index({ companyId: 1, name: 1 }, { unique: true });
roleSchema.index({ companyId: 1, status: 1 });

module.exports = model('Role', roleSchema);
