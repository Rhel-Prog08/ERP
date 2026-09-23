'use strict';

const { AUDIT_ACTIONS } = require('../../config/constants');

/** GET /audit — filtros de la bitácora (sólo lectura). */
const auditListSchema = {
  page: { type: 'integer', min: 1 },
  limit: { type: 'integer', min: 1, max: 100 },
  action: { type: 'enum', enum: AUDIT_ACTIONS },
  module: { type: 'string', maxLength: 40 },
  entity: { type: 'string', maxLength: 60 },
  entityId: { type: 'string', maxLength: 64 },
  userId: { type: 'objectId' },
  dateFrom: { type: 'date' },
  dateTo: { type: 'date' },
};

module.exports = { auditListSchema };
