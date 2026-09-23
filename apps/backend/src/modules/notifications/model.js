'use strict';

const { Schema, model } = require('mongoose');

/**
 * notifications — avisos POR EMPRESA (hoy: alertas de stock bajo).
 * Colección de escritura sencilla: se crean desde los módulos operativos
 * (inventario/productos) y el usuario sólo las lista/marca como leídas.
 */
const notificationSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    type: { type: String, enum: ['LOW_STOCK'], default: 'LOW_STOCK' },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, trim: true, maxlength: 300 },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ companyId: 1, createdAt: -1 });
notificationSchema.index({ companyId: 1, read: 1, createdAt: -1 });

module.exports = model('Notification', notificationSchema);
