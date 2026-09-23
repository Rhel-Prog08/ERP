'use strict';

/**
 * Serialización CSV ligera (sin dependencias).
 * - BOM UTF-8 para que Excel reconozca acentos.
 * - Escapado estándar: comillas duplicadas, envoltura si contiene , " \n.
 */
function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const str = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows) {
  const BOM = '\uFEFF';
  if (!Array.isArray(rows) || rows.length === 0) return BOM;
  // Unión de claves: cabeceras estables aunque falten campos en alguna fila.
  const headers = [];
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCell(row[h])).join(','));
  }
  return BOM + lines.join('\r\n') + '\r\n';
}

module.exports = { toCsv, escapeCell };
