'use strict';

const Settings = require('./model');
const { SETTINGS_DEFAULTS } = require('../../config/constants');

/**
 * Servicio de configuración compartido:
 * - routes de settings (GET/PATCH)
 * - empresas al crearse (defaults)
 * - ventas/compras dentro de transacción (taxRate, allowNegativeStock)
 */

/**
 * Obtiene (o crea) la configuración de la empresa.
 * Compatible con transacciones: `session` opcional.
 */
async function getForCompany(companyId, session = null) {
  let query = Settings.findOne({ companyId });
  if (session) query = query.session(session);
  const existing = await query;
  if (existing) return existing;

  try {
    const created = await Settings.create(
      [{ companyId, ...SETTINGS_DEFAULTS }],
      session ? { session } : {}
    );
    return created[0];
  } catch (err) {
    // Carrera entre dos creaciones simultáneas → reintentar leer.
    if (err.code === 11000) {
      let retry = Settings.findOne({ companyId });
      if (session) retry = retry.session(session);
      return retry;
    }
    throw err;
  }
}

/** Actualiza ajustes de la empresa. Devuelve { before, after }. */
async function updateForCompany(companyId, patch) {
  const before = await getForCompany(companyId);
  const snapshot = { taxRate: before.taxRate, allowNegativeStock: before.allowNegativeStock };
  if (patch.taxRate !== undefined) before.taxRate = patch.taxRate;
  if (patch.allowNegativeStock !== undefined) before.allowNegativeStock = patch.allowNegativeStock;
  await before.save();
  return {
    before: snapshot,
    after: { taxRate: before.taxRate, allowNegativeStock: before.allowNegativeStock },
    doc: before,
  };
}

module.exports = { getForCompany, updateForCompany };
