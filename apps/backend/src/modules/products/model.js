'use strict';

const { Schema, model } = require('mongoose');
const { STATUSES, UNITS } = require('../../config/constants');

/**
 * products — productos por empresa. SKU único por companyId.
 * Baja lógica mediante status = inactive. NO guarda existencias:
 * el stock vive en el módulo inventory (movimientos por almacén).
 */
const productSchema = new Schema(
  {
    sku: { type: String, required: true, trim: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500 },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', default: null },
    purchasePrice: { type: Number, required: true, min: 0, default: 0 },
    salePrice: { type: Number, required: true, min: 0, default: 0 },
    stockMin: { type: Number, required: true, min: 0, default: 0 },
    unit: { type: String, enum: UNITS, default: 'unidad' },
    status: { type: String, enum: STATUSES, default: 'active' },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  },
  { timestamps: true }
);

productSchema.index({ companyId: 1, sku: 1 }, { unique: true });
productSchema.index({ companyId: 1, name: 1 });
productSchema.index({ companyId: 1, categoryId: 1 });
productSchema.index({ companyId: 1, status: 1 });

module.exports = model('Product', productSchema);
