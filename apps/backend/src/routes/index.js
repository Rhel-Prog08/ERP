'use strict';

/**
 * Enrutador raíz — todas las rutas se sirven bajo /api/v1.
 * Cada módulo exporta su router desde modules/<módulo>/routes.js.
 */
const router = require('express').Router();

router.use('/auth', require('../modules/auth/routes'));
router.use('/users', require('../modules/users/routes'));
router.use('/roles', require('../modules/roles/routes'));
router.use('/permissions', require('../modules/permissions/routes'));
router.use('/companies', require('../modules/companies/routes'));
router.use('/branches', require('../modules/branches/routes'));
router.use('/warehouses', require('../modules/warehouses/routes'));
router.use('/customers', require('../modules/customers/routes'));
router.use('/suppliers', require('../modules/suppliers/routes'));
router.use('/categories', require('../modules/categories/routes'));
router.use('/products', require('../modules/products/routes'));
router.use('/inventory', require('../modules/inventory/routes'));
router.use('/sales', require('../modules/sales/routes'));
router.use('/purchases', require('../modules/purchases/routes'));
router.use('/dashboard', require('../modules/dashboard/routes'));
router.use('/reports', require('../modules/reports/routes'));
router.use('/audit', require('../modules/audit/routes'));
router.use('/settings', require('../modules/settings/routes'));
router.use('/notifications', require('../modules/notifications/routes'));

module.exports = router;
