'use strict';

const { Schema, model } = require('mongoose');
const { MOVEMENT_TYPES } = require('../../config/constants');

/**
 * Inventario separado en DOS colecciones:
 *  - StockBalance: existencia actual por producto+almacén (libro mayor).
 *  - StockMovement: cada cambio con trazabilidad completa
 *    (cantidad anterior/nueva, referencia, usuario, empresa).
 * NUNCA se modifica el stock sin crear su movimiento.
 */

const stockBalanceSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    // Sin min:0 a nivel de esquema para permitir allowNegativeStock cuando
    // la empresa lo activa; la validación de signo vive en el servicio.
    quantity: { type: Number, required: true, default: 0 },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  },
  { timestamps: true }
);

stockBalanceSchema.index({ companyId: 1, productId: 1, warehouseId: 1 }, { unique: true });
stockBalanceSchema.index({ companyId: 1, warehouseId: 1 });

const stockMovementSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    type: { type: String, enum: MOVEMENT_TYPES, required: true },
    quantity: { type: Number, required: true, min: 0 },
    previousQuantity: { type: Number, required: true, min: 0 },
    newQuantity: { type: Number, required: true, min: 0 },
    referenceType: { type: String, maxlength: 20, default: null }, // SALE | PURCHASE | MANUAL
    referenceId: { type: String, maxlength: 64, default: null },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, maxlength: 200 },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Índice justificado (spec §34): consultas de historial por producto+almacén.
stockMovementSchema.index({ productId: 1, warehouseId: 1, createdAt: -1 });
stockMovementSchema.index({ companyId: 1, createdAt: -1 });
stockMovementSchema.index({ referenceType: 1, referenceId: 1 });

const StockBalance = model('StockBalance', stockBalanceSchema);
const StockMovement = model('StockMovement', stockMovementSchema);

module.exports = { StockBalance, StockMovement };
