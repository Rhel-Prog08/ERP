'use strict';

const { Schema, model } = require('mongoose');
const { STATUSES } = require('../../config/constants');

/**
 * customers — clientes por empresa. Código humano (CL-00001) único
 * por companyId. Baja lógica mediante status = inactive.
 */
const customerSchema = new Schema(
  {
    customerCode: { type: String, required: true, trim: true, maxlength: 20 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    companyName: { type: String, trim: true, maxlength: 160 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    phone: { type: String, trim: true, maxlength: 40 },
    address: { type: String, trim: true, maxlength: 240 },
    status: { type: String, enum: STATUSES, default: 'active' },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  },
  { timestamps: true }
);

customerSchema.index({ companyId: 1, customerCode: 1 }, { unique: true });
customerSchema.index({ companyId: 1, name: 1 });
customerSchema.index({ companyId: 1, status: 1 });

module.exports = model('Customer', customerSchema);
