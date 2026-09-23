'use strict';

const { Schema, model } = require('mongoose');
const { STATUSES } = require('../../config/constants');

/**
 * companies — raíz del aislamiento multiempresa.
 * Todos los módulos operativos referencian companyId a esta colección.
 */
const companySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    legalName: { type: String, trim: true, maxlength: 160 },
    taxId: { type: String, trim: true, maxlength: 40 },
    phone: { type: String, trim: true, maxlength: 40 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    address: { type: String, trim: true, maxlength: 240 },
    status: { type: String, enum: STATUSES, default: 'active' },
  },
  { timestamps: true }
);

companySchema.index({ name: 1 });
companySchema.index({ status: 1 });

module.exports = model('Company', companySchema);
