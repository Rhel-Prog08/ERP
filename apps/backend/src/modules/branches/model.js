'use strict';

const { Schema, model } = require('mongoose');
const { STATUSES } = require('../../config/constants');

/**
 * branches — sucursales de cada empresa (multiempresa).
 */
const branchSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    address: { type: String, trim: true, maxlength: 240 },
    phone: { type: String, trim: true, maxlength: 40 },
    status: { type: String, enum: STATUSES, default: 'active' },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  },
  { timestamps: true }
);

branchSchema.index({ companyId: 1, name: 1 }, { unique: true });
branchSchema.index({ companyId: 1, status: 1 });

module.exports = model('Branch', branchSchema);
