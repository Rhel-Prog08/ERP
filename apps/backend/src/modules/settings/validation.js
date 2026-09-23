'use strict';

/** PATCH /settings — ajustes de la empresa autenticada. */
const settingsUpdateSchema = {
  taxRate: { type: 'number', min: 0, max: 1 },
  allowNegativeStock: { type: 'boolean' },
};

module.exports = { settingsUpdateSchema };
