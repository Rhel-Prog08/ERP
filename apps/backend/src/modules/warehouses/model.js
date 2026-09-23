'use strict';

const { Schema, model } = require('mongoose');
const { STATUSES } = require('../../config/constants');

/**
 * warehouses — almacenes por empresa, opcionalmente ligados a una sucursal.
 * Un almacén sin branchId pertenece a la matriz de la empresa.
 */
const warehouseSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    status: { type: String, enum: STATUSES, default: 'active' },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  },
  { timestamps: true }
);

warehouseSchema.index({ companyId: 1, name: 1 }, { unique: true });
warehouseSchema.index({ companyId: 1, branchId: 1 });
warehouseSchema.index({ companyId: 1, status: 1 });

module.exports = model('Warehouse', warehouseSchema);
