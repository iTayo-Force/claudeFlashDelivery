const express = require('express');
const { z } = require('zod');
const { employeeAuth, requirePermission } = require('../middleware/employeeAuth');
const validateRequest = require('../middleware/validateRequest');
const deliveryService = require('../services/deliveryService');
const paymentService = require('../services/paymentService');

const router = express.Router();

// All delivery routes require employee auth + 'deliveries' permission
router.use(employeeAuth, requirePermission('deliveries'));

// --- Schemas ---
const createSchema = z.object({
  senderId: z.string().min(1),
  recipientId: z.string().optional(),
  pickupLocationName: z.string().min(1),
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  deliveryLocationName: z.string().min(1),
  deliveryLat: z.number().min(-90).max(90),
  deliveryLng: z.number().min(-180).max(180),
  description: z.string().max(255).optional(),
  comment: z.string().max(255).optional(),
  type: z.string().optional(),
  paymentMethod: z.string().optional(),
  deliveryDateTime: z.string().optional(),
  freeDelivery: z.boolean().optional(),
});

const updateSchema = z.object({
  driverId: z.string().optional(),
  deliveryManagerId: z.string().optional(),
  salesRepId: z.string().optional(),
  recipientId: z.string().optional(),
  paymentMethod: z.string().optional(),
  description: z.string().max(255).optional(),
  comment: z.string().max(255).optional(),
  type: z.string().optional(),
  pickupLocationName: z.string().optional(),
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  deliveryLocationName: z.string().optional(),
  deliveryLat: z.number().optional(),
  deliveryLng: z.number().optional(),
  deliveryDateTime: z.string().optional(),
  freeDelivery: z.boolean().optional(),
});

const statusSchema = z.object({
  status: z.enum(['New', 'Assigned', 'Picked Up', 'In Transit', 'Delivered', 'Cancelled']),
  amountCollected: z.number().optional(),
  cancellationReason: z.string().max(255).optional(),
});

const listSchema = z.object({
  status: z.string().optional(),
  city: z.string().optional(),
  driverId: z.string().optional(),
  managerId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

/**
 * GET /api/deliveries
 * List deliveries with filters.
 */
router.get('/', validateRequest(listSchema, 'query'), async (req, res, next) => {
  try {
    const { status, city, driverId, managerId, dateFrom, dateTo, limit, offset } = req.query;
    const result = await deliveryService.list({
      status, city, driverId, managerId, dateFrom, dateTo,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/deliveries
 * Create a delivery (employee-initiated).
 */
router.post('/', validateRequest(createSchema), async (req, res, next) => {
  try {
    const deliveryId = await deliveryService.create(req.body);
    const delivery = await deliveryService.findById(deliveryId);
    res.status(201).json(delivery);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/deliveries/:id
 * Get delivery details.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const delivery = await deliveryService.findById(req.params.id);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    res.json(delivery);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/deliveries/:id
 * Update delivery fields.
 */
router.patch('/:id', validateRequest(updateSchema), async (req, res, next) => {
  try {
    await deliveryService.update(req.params.id, req.body);
    const delivery = await deliveryService.findById(req.params.id);
    res.json(delivery);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/deliveries/:id/status
 * Update delivery status with transition validation.
 */
router.post('/:id/status', validateRequest(statusSchema), async (req, res, next) => {
  try {
    const { status, amountCollected, cancellationReason } = req.body;
    await deliveryService.updateStatus(req.params.id, status, {
      amountCollected,
      cancellationReason,
    });

    // If delivered and amount collected, create a payment record
    if (status === 'Delivered' && amountCollected) {
      const delivery = await deliveryService.findById(req.params.id);
      if (delivery) {
        const paymentId = await paymentService.create({
          accountId: delivery.Sender__c,
          amount: amountCollected,
          deliveryId: req.params.id,
          status: 'Completed',
          label: `Delivery ${delivery.Delivery_Reference__c || delivery.Name}`,
        });
        await paymentService.createLineItem({
          paymentId,
          amount: amountCollected,
        });
      }
    }

    const updated = await deliveryService.findById(req.params.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/deliveries/:id/payments
 * Get payments linked to a delivery.
 */
router.get('/:id/payments', async (req, res, next) => {
  try {
    const payments = await paymentService.listByDelivery(req.params.id);
    res.json(payments);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
