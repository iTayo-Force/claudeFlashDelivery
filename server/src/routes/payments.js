const express = require('express');
const { z } = require('zod');
const { employeeAuth, requirePermission } = require('../middleware/employeeAuth');
const validateRequest = require('../middleware/validateRequest');
const validateSfIdParam = require('../middleware/validateSfId');
const paymentService = require('../services/paymentService');

const SF_ID_REGEX = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/;

const router = express.Router();

// Payments are accessible to employees with dashboard or deliveries access
router.use(employeeAuth);

const createSchema = z.object({
  accountId: z.string().regex(SF_ID_REGEX, 'Invalid Salesforce ID'),
  amount: z.number().positive(),
  deliveryId: z.string().regex(SF_ID_REGEX, 'Invalid Salesforce ID').optional(),
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
  status: z.enum(['Draft', 'Pending', 'Completed', 'Failed', 'Cancelled']),
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
router.get('/:id', requirePermission('deliveries'), validateSfIdParam(), async (req, res, next) => {
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
router.patch('/:id/status', requirePermission('dashboard'), validateSfIdParam(), validateRequest(statusSchema), async (req, res, next) => {
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
router.get('/:id/line-items', requirePermission('deliveries'), validateSfIdParam(), async (req, res, next) => {
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
router.post('/:id/line-items', requirePermission('deliveries'), validateSfIdParam(), validateRequest(lineItemSchema), async (req, res, next) => {
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
