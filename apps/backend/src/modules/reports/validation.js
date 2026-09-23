'use strict';

const { SALE_STATUS, PURCHASE_STATUS, STATUSES, MOVEMENT_TYPES } = require('../../config/constants');

const formatField = { format: { type: 'enum', enum: ['csv'] } };

const dateFields = {
  dateFrom: { type: 'date' },
  dateTo: { type: 'date' },
};

/** GET /reports/sales y /reports/purchases */
const salesReportSchema = {
  ...formatField,
  ...dateFields,
  status: { type: 'enum', enum: SALE_STATUS },
  warehouseId: { type: 'objectId' },
  userId: { type: 'objectId' },
};

const purchasesReportSchema = {
  ...formatField,
  ...dateFields,
  status: { type: 'enum', enum: PURCHASE_STATUS },
  warehouseId: { type: 'objectId' },
  userId: { type: 'objectId' },
};

/** GET /reports/inventory */
const inventoryReportSchema = {
  ...formatField,
  warehouseId: { type: 'objectId' },
};

/** GET /reports/movements */
const movementsReportSchema = {
  ...formatField,
  ...dateFields,
  type: { type: 'enum', enum: MOVEMENT_TYPES },
  warehouseId: { type: 'objectId' },
  productId: { type: 'objectId' },
  userId: { type: 'objectId' },
};

/** GET /reports/products */
const productsReportSchema = {
  ...formatField,
  status: { type: 'enum', enum: STATUSES },
  categoryId: { type: 'objectId' },
  supplierId: { type: 'objectId' },
};

/** GET /reports/customers y /reports/suppliers */
const masterReportSchema = {
  ...formatField,
  status: { type: 'enum', enum: STATUSES },
};

/** GET /reports/audit */
const auditReportSchema = {
  ...formatField,
  ...dateFields,
  action: { type: 'string', maxLength: 40 },
  module: { type: 'string', maxLength: 40 },
  userId: { type: 'objectId' },
};

module.exports = {
  salesReportSchema,
  purchasesReportSchema,
  inventoryReportSchema,
  movementsReportSchema,
  productsReportSchema,
  masterReportSchema,
  auditReportSchema,
};
