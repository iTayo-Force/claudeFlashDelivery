const express = require('express');
const { z } = require('zod');
const { employeeAuth, requirePermission } = require('../middleware/employeeAuth');
const validateRequest = require('../middleware/validateRequest');
const paymentService = require('../services/paymentService');

const router = express.Router();

// Payments are accessible to employees with dashboard or deliveries access
router.use(employeeAuth);

const createSchema = z.object({
  accountId: z.string().min(1),
  amount: z.number().positive(),
  deliveryId: z.string().optional(),
  type: z.enum(['Income', 'Expense']).optional(),
  status: z.string().optional(),
  label: z.string().optional(),
  incomeCategory: z.string().optional(),
  expenseCategory: z.string().optional(),
  dueDate: z.string().optional(),
});

const lineItemSchema = z.object({
  amount: z.number().positive(),
});

const statusSchema = z.object({
  status: z.string().min(1),
});

/**
 * GET /api/payments
 * List payments with filters.
 */
router.get('/', requirePermission('dashboard'), async (req, res, next) => {
  try {
    const { status, type, dateFrom, dateTo, limit, offset } = req.query;
    const result = await paymentService.list({
      status, type, dateFrom, dateTo,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/payments
 * Create a payment record.
 */
router.post('/', requirePermission('deliveries'), validateRequest(createSchema), async (req, res, next) => {
  try {
    const id = await paymentService.create(req.body);
    const payment = await paymentService.findById(id);
    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/payments/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const payment = await paymentService.findById(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json(payment);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/payments/:id/status
 * Update payment status.
 */
router.patch('/:id/status', requirePermission('dashboard'), validateRequest(statusSchema), async (req, res, next) => {
  try {
    await paymentService.updateStatus(req.params.id, req.body.status);
    const payment = await paymentService.findById(req.params.id);
    res.json(payment);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/payments/:id/line-items
 * Get line items for a payment.
 */
router.get('/:id/line-items', async (req, res, next) => {
  try {
    const items = await paymentService.getLineItems(req.params.id);
    res.json(items);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/payments/:id/line-items
 * Add a line item to a payment.
 */
router.post('/:id/line-items', requirePermission('deliveries'), validateRequest(lineItemSchema), async (req, res, next) => {
  try {
    const id = await paymentService.createLineItem({
      paymentId: req.params.id,
      amount: req.body.amount,
    });
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
