'use strict';

const { Schema, model } = require('mongoose');
const { PURCHASE_STATUS } = require('../../config/constants');

/**
 * purchases — compras multiempresa con snapshot de items.
 *
 * Estados y efecto sobre inventario (FLUJO B):
 *  DRAFT      → sin efecto
 *  CONFIRMED  → sin efecto aún (validación de precios/cantidades)
 *  RECEIVED   → inventario SUMA + movimiento ENTRY + actualiza
 *               product.purchasePrice + auditoría
 *  CANCELLED  → si estaba RECEIVED se revierte con EXIT
 */
const purchaseItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String, required: true, maxlength: 40 },
    name: { type: String, required: true, maxlength: 120 },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const purchaseSchema = new Schema(
  {
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
    items: { type: [purchaseItemSchema], required: true, validate: (v) => v.length > 0 },
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: PURCHASE_STATUS, default: 'DRAFT' },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, maxlength: 300 },
    confirmedAt: { type: Date },
    receivedAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: { type: Date },
    cancelReason: { type: String, maxlength: 200 },
  },
  { timestamps: true }
);

// Índice justificado (spec §34): listados por empresa ordenados por fecha.
purchaseSchema.index({ companyId: 1, createdAt: -1 });
purchaseSchema.index({ companyId: 1, status: 1, createdAt: -1 });
purchaseSchema.index({ supplierId: 1, createdAt: -1 });
purchaseSchema.index({ warehouseId: 1 });

module.exports = model('Purchase', purchaseSchema);
