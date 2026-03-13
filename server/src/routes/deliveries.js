const express = require('express');
const { z } = require('zod');
const { employeeAuth, requirePermission } = require('../middleware/employeeAuth');
const validateRequest = require('../middleware/validateRequest');
const validateSfIdParam = require('../middleware/validateSfId');
const deliveryService = require('../services/deliveryService');
const paymentService = require('../services/paymentService');
const realtimeService = require('../services/realtimeService');
const pushNotificationService = require('../services/pushNotificationService');

const SF_ID_REGEX = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const router = express.Router();

// All delivery routes require employee auth + 'deliveries' permission
router.use(employeeAuth, requirePermission('deliveries'));

// --- Schemas ---
const createSchema = z.object({
  senderId: z.string().regex(SF_ID_REGEX, 'Invalid Salesforce ID'),
  recipientId: z.string().regex(SF_ID_REGEX, 'Invalid Salesforce ID').optional(),
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
  driverId: z.string().regex(SF_ID_REGEX, 'Invalid Salesforce ID').optional(),
  deliveryManagerId: z.string().regex(SF_ID_REGEX, 'Invalid Salesforce ID').optional(),
  salesRepId: z.string().regex(SF_ID_REGEX, 'Invalid Salesforce ID').optional(),
  recipientId: z.string().regex(SF_ID_REGEX, 'Invalid Salesforce ID').optional(),
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
  status: z.enum(['Ordered', 'Picked up', 'Canceled', 'Delivered']),
  amountCollected: z.number().optional(),
  cancellationReason: z.string().max(255).optional(),
});

const listSchema = z.object({
  status: z.enum(['Ordered', 'Picked up', 'Canceled', 'Delivered']).optional(),
  city: z.string().max(50).optional(),
  driverId: z.string().regex(SF_ID_REGEX, 'Invalid Salesforce ID').optional(),
  managerId: z.string().regex(SF_ID_REGEX, 'Invalid Salesforce ID').optional(),
  dateFrom: z.string().regex(DATE_REGEX, 'Expected YYYY-MM-DD').optional(),
  dateTo: z.string().regex(DATE_REGEX, 'Expected YYYY-MM-DD').optional(),
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
router.get('/:id', validateSfIdParam(), async (req, res, next) => {
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
router.patch('/:id', validateSfIdParam(), validateRequest(updateSchema), async (req, res, next) => {
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
router.post('/:id/status', validateSfIdParam(), validateRequest(statusSchema), async (req, res, next) => {
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

    // Broadcast status change via WebSocket
    realtimeService.broadcastDeliveryUpdate(req.params.id, {
      status: updated.Status__c,
      driverId: updated.Driver__c,
    });

    // Send push notification to sender
    if (updated.Sender__c) {
      pushNotificationService.notifyDeliveryStatus(updated.Sender__c, {
        id: updated.Id,
        ref: updated.Delivery_Reference__c || updated.Name,
      }, status).catch((err) => {
        console.error('Push notification failed:', err.message);
      });
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/deliveries/:id/payments
 * Get payments linked to a delivery.
 */
router.get('/:id/payments', validateSfIdParam(), async (req, res, next) => {
  try {
    const payments = await paymentService.listByDelivery(req.params.id);
    res.json(payments);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
