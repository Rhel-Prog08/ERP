'use strict';

const { Schema, model } = require('mongoose');
const { STATUSES } = require('../../config/constants');

/**
 * categories — categorías de productos por empresa. Nombre único
 * por companyId. Baja lógica mediante status = inactive (bloqueada
 * si hay productos activos que la usan; ver routes.js beforeDelete).
 */
const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 240 },
    status: { type: String, enum: STATUSES, default: 'active' },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  },
  { timestamps: true }
);

categorySchema.index({ companyId: 1, name: 1 }, { unique: true });
categorySchema.index({ companyId: 1, status: 1 });

module.exports = model('Category', categorySchema);
