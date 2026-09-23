'use strict';

const { Schema, model } = require('mongoose');
const { SALE_STATUS } = require('../../config/constants');

/**
 * sales — ventas multiempresa.
 * Los items guardan SNAPSHOT de sku/nombre/precio del momento de la venta
 * (el histórico no cambia si luego se modifica el producto).
 *
 * Estados y efecto sobre inventario:
 *  DRAFT      → sin efecto (borrador editable sólo por creación)
 *  CONFIRMED  → stock DESCONTADO + movimiento EXIT (paso confirm)
 *  COMPLETED  → finalize de negocio (sin nuevo efecto de stock)
 *  CANCELLED  → si venía de CONFIRMED/COMPLETED se revierte con RETURN
 */
const saleItemSchema = new Schema(
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

const saleSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    items: { type: [saleItemSchema], required: true, validate: (v) => v.length > 0 },
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: SALE_STATUS, default: 'DRAFT' },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, maxlength: 300 },
    confirmedAt: { type: Date },
    completedAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: { type: Date },
    cancelReason: { type: String, maxlength: 200 },
  },
  { timestamps: true }
);

// Índice justificado (spec §34): listados por empresa ordenados por fecha.
saleSchema.index({ companyId: 1, createdAt: -1 });
saleSchema.index({ companyId: 1, status: 1, createdAt: -1 });
saleSchema.index({ customerId: 1, createdAt: -1 });
saleSchema.index({ warehouseId: 1 });

module.exports = model('Sale', saleSchema);
