'use strict';

const { Schema, model } = require('mongoose');

/**
 * Contadores por empresa para códigos humanos secuenciales
 * (customerCode "CL-00001", supplierCode "PR-00001").
 * findOneAndUpdate con $inc es atómico: sin condiciones de carrera.
 */
const sequenceSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, required: true },
  entity: { type: String, required: true, maxlength: 40 },
  seq: { type: Number, required: true, default: 0 },
});

sequenceSchema.index({ companyId: 1, entity: 1 }, { unique: true });

const Sequence = model('Sequence', sequenceSchema);

/** Siguiente número de secuencia para (empresa, entidad). Transaccional si hay session. */
async function nextSequence(companyId, entity, session = null) {
  const doc = await Sequence.findOneAndUpdate(
    { companyId, entity },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, ...(session ? { session } : {}) }
  ).lean();
  return doc.seq;
}

/** Formatea: formatCode('CL', 7) → 'CL-00007'. */
function formatCode(prefix, seq) {
  return `${prefix}-${String(seq).padStart(5, '0')}`;
}

module.exports = { Sequence, nextSequence, formatCode };
