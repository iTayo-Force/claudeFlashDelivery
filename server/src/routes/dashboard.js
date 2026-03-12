const express = require('express');
const { employeeAuth, requirePermission } = require('../middleware/employeeAuth');
const dashboardService = require('../services/dashboardService');

const router = express.Router();

router.use(employeeAuth, requirePermission('dashboard'));

/**
 * GET /api/dashboard/stats
 * Delivery stats (counts by status, revenue, avg times).
 */
router.get('/stats', async (req, res, next) => {
  try {
    const { dateFrom, dateTo, city } = req.query;
    const stats = await dashboardService.getDeliveryStats({ dateFrom, dateTo, city });
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/dashboard/drivers
 * Driver performance stats.
 */
router.get('/drivers', async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const stats = await dashboardService.getDriverStats({ dateFrom, dateTo });
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/dashboard/revenue-by-city
 * Revenue breakdown by city.
 */
router.get('/revenue-by-city', async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const stats = await dashboardService.getRevenueByCity({ dateFrom, dateTo });
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/dashboard/accounts
 * Account stats (total, active last 30 days).
 */
router.get('/accounts', async (req, res, next) => {
  try {
    const stats = await dashboardService.getAccountStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
