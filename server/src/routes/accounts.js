const express = require('express');
const { z } = require('zod');
const { employeeAuth, requirePermission } = require('../middleware/employeeAuth');
const validateRequest = require('../middleware/validateRequest');
const accountService = require('../services/accountService');
const deliveryService = require('../services/deliveryService');

const router = express.Router();

router.use(employeeAuth, requirePermission('accounts'));

const updateSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  email: z.string().email().optional(),
  language: z.enum(['French', 'English']).optional(),
  mainPickupLocation: z.string().optional(),
  mainPickupLat: z.number().optional(),
  mainPickupLng: z.number().optional(),
  mainDeliveryLocation: z.string().optional(),
  mainDeliveryLat: z.number().optional(),
  mainDeliveryLng: z.number().optional(),
  accountManager: z.string().optional(),
  followUpDate: z.string().optional(),
});

/**
 * GET /api/accounts
 * List accounts with pagination & scoring filter.
 */
router.get('/', async (req, res, next) => {
  try {
    const { scoring, limit, offset } = req.query;
    const result = await accountService.list({
      scoring,
      limit: parseInt(limit, 10) || 20,
      offset: parseInt(offset, 10) || 0,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/accounts/search
 * Search accounts by name or phone.
 */
router.get('/search', async (req, res, next) => {
  try {
    const { q, limit } = req.query;
    if (!q || q.length < 2) return res.status(400).json({ error: 'Query must be at least 2 characters' });
    const records = await accountService.search(q, parseInt(limit, 10) || 20);
    res.json(records);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/accounts/:id
 * Get account details.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const account = await accountService.findById(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json(account);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/accounts/:id
 * Update account.
 */
router.patch('/:id', validateRequest(updateSchema), async (req, res, next) => {
  try {
    await accountService.update(req.params.id, req.body);
    const updated = await accountService.findById(req.params.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/accounts/:id/deliveries
 * List deliveries for an account.
 */
router.get('/:id/deliveries', async (req, res, next) => {
  try {
    const { status, limit, offset } = req.query;
    const result = await deliveryService.listByAccount(req.params.id, {
      status,
      limit: parseInt(limit, 10) || 20,
      offset: parseInt(offset, 10) || 0,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
