'use strict';

const { Types } = require('mongoose');
const Sale = require('../sales/model');
const Purchase = require('../purchases/model');
const Product = require('../products/model');
const Customer = require('../customers/model');
const Supplier = require('../suppliers/model');
const StockBalance = require('../inventory/model').StockBalance;

/**
 * Dashboard — TODOS los indicadores se calculan con agregaciones reales
 * de MongoDB de la empresa del token (spec §51: sin números ficticios).
 */

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function sumSales(companyId, dateFrom) {
  const [result] = await Sale.aggregate([
    {
      $match: {
        companyId: Types.ObjectId.createFromHexString(companyId),
        status: { $in: ['CONFIRMED', 'COMPLETED'] },
        ...(dateFrom ? { createdAt: { $gte: dateFrom } } : {}),
      },
    },
    { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
  ]);
  return { total: result ? Math.round(result.total * 100) / 100 : 0, count: result ? result.count : 0 };
}

async function sumPurchases(companyId, dateFrom) {
  const [result] = await Purchase.aggregate([
    {
      $match: {
        companyId: Types.ObjectId.createFromHexString(companyId),
        status: { $in: ['CONFIRMED', 'RECEIVED'] },
        ...(dateFrom ? { createdAt: { $gte: dateFrom } } : {}),
      },
    },
    { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
  ]);
  return { total: result ? Math.round(result.total * 100) / 100 : 0, count: result ? result.count : 0 };
}

/** Productos activos cuya existencia TOTAL (todos los almacenes) <= stockMin. */
async function lowStockProducts(companyId) {
  const rows = await Product.aggregate([
    { $match: { companyId: Types.ObjectId.createFromHexString(companyId), status: 'active' } },
    {
      $lookup: {
        from: 'stockbalances',
        let: { pid: '$_id' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$productId', '$$pid'] }, { $eq: ['$companyId', Types.ObjectId.createFromHexString(companyId)] }] } } },
          { $group: { _id: null, total: { $sum: '$quantity' } } },
        ],
        as: 'balances',
      },
    },
    {
      $addFields: {
        totalStock: { $ifNull: [{ $arrayElemAt: ['$balances.total', 0] }, 0] },
      },
    },
    { $match: { $expr: { $lte: ['$totalStock', '$stockMin'] } } },
    { $project: { sku: 1, name: 1, stockMin: 1, totalStock: 1, unit: 1 } },
    { $sort: { totalStock: 1 } },
  ]);
  return rows;
}

/** Serie diaria de ventas de los últimos 30 días (para la gráfica). */
async function salesSeries(companyId) {
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return Sale.aggregate([
    {
      $match: {
        companyId: Types.ObjectId.createFromHexString(companyId),
        status: { $in: ['CONFIRMED', 'COMPLETED'] },
        createdAt: { $gte: from },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        total: { $sum: '$total' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: '$_id', total: { $round: ['$total', 2] }, count: 1 } },
  ]);
}

/** Top 5 productos vendidos (30 días) — nombres del snapshot de la venta. */
async function topProducts(companyId) {
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return Sale.aggregate([
    {
      $match: {
        companyId: Types.ObjectId.createFromHexString(companyId),
        status: { $in: ['CONFIRMED', 'COMPLETED'] },
        createdAt: { $gte: from },
      },
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        sku: { $first: '$items.sku' },
        name: { $first: '$items.name' },
        quantity: { $sum: '$items.quantity' },
        revenue: { $sum: '$items.subtotal' },
      },
    },
    { $sort: { quantity: -1 } },
    { $limit: 5 },
    { $project: { _id: 0, productId: '$_id', sku: 1, name: 1, quantity: 1, revenue: { $round: ['$revenue', 2] } } },
  ]);
}

async function getDashboard(actor) {
  const companyId = actor.companyId;

  const [
    salesToday,
    salesMonth,
    purchasesMonth,
    totalProducts,
    totalCustomers,
    totalSuppliers,
    lowStock,
    recentSales,
    recentPurchases,
    salesByPeriod,
    topSelling,
  ] = await Promise.all([
    sumSales(companyId, startOfToday()),
    sumSales(companyId, startOfMonth()),
    sumPurchases(companyId, startOfMonth()),
    Product.countDocuments({ companyId }),
    Customer.countDocuments({ companyId }),
    Supplier.countDocuments({ companyId }),
    lowStockProducts(companyId),
    Sale.find({ companyId, status: { $in: ['CONFIRMED', 'COMPLETED'] } })
      .populate('customerId', 'name customerCode')
      .sort('-createdAt')
      .limit(10)
      .lean(),
    Purchase.find({ companyId, status: { $in: ['CONFIRMED', 'RECEIVED'] } })
      .populate('supplierId', 'name supplierCode')
      .sort('-createdAt')
      .limit(10)
      .lean(),
    salesSeries(companyId),
    topProducts(companyId),
  ]);

  return {
    kpi: {
      salesToday: salesToday.total,
      salesTodayCount: salesToday.count,
      salesMonth: salesMonth.total,
      salesMonthCount: salesMonth.count,
      purchasesMonth: purchasesMonth.total,
      purchasesMonthCount: purchasesMonth.count,
      totalProducts,
      lowStockCount: lowStock.length,
      totalCustomers,
      totalSuppliers,
    },
    recentSales,
    recentPurchases,
    lowStock: lowStock.slice(0, 10),
    salesByPeriod,
    topProducts: topSelling,
  };
}

module.exports = { getDashboard };
