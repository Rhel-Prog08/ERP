'use strict';

const { Schema, model } = require('mongoose');
const { SETTINGS_DEFAULTS } = require('../../config/constants');

/**
 * settings — configuración por empresa (singleton por companyId).
 * De aquí salen taxRate y allowNegativeStock que usan ventas/compras.
 */
const settingsSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, unique: true },
    taxRate: { type: Number, required: true, default: SETTINGS_DEFAULTS.taxRate, min: 0, max: 1 },
    allowNegativeStock: {
      type: Boolean,
      required: true,
      default: SETTINGS_DEFAULTS.allowNegativeStock,
    },
  },
  { timestamps: true }
);

module.exports = model('Setting', settingsSchema);
