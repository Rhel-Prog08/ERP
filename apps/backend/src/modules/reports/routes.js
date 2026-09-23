'use strict';

/**
 * GET /api/v1/reports/<tipo> — 8 reportes con filtros.
 *  JSON por defecto; ?format=csv exige reports.export y deja auditoría.
 *  Todas las consultas se limitan a la empresa del token.
 */
const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { validateQuery } = require('../../utils/validate');
const service = require('./service');
const {
  salesReportSchema,
  purchasesReportSchema,
  inventoryReportSchema,
  movementsReportSchema,
  productsReportSchema,
  masterReportSchema,
  auditReportSchema,
} = require('./validation');

function reportRoute(path, schema, name, fetch) {
  router.get(
    path,
    authenticate,
    authorize('reports.read'),
    validateQuery(schema),
    asyncHandler(async (req, res) => {
      await service.runReport(req, res, { name, schema, fetch });
    })
  );
}

reportRoute('/sales', salesReportSchema, 'sales', service.fetchSales);
reportRoute('/purchases', purchasesReportSchema, 'purchases', service.fetchPurchases);
reportRoute('/inventory', inventoryReportSchema, 'inventory', service.fetchInventory);
reportRoute('/movements', movementsReportSchema, 'movements', service.fetchMovements);
reportRoute('/products', productsReportSchema, 'products', service.fetchProducts);
reportRoute('/customers', masterReportSchema, 'customers', service.fetchCustomers);
reportRoute('/suppliers', masterReportSchema, 'suppliers', service.fetchSuppliers);
reportRoute('/audit', auditReportSchema, 'audit', service.fetchAudit);

module.exports = router;
