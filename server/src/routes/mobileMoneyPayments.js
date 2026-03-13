const express = require('express');
const { z } = require('zod');
const { clientAuth } = require('../middleware/clientAuth');
const { employeeAuth } = require('../middleware/employeeAuth');
const validateRequest = require('../middleware/validateRequest');
const validateSfIdParam = require('../middleware/validateSfId');
const mobileMoneyService = require('../services/mobileMoneyService');
const paymentService = require('../services/paymentService');
const deliveryService = require('../services/deliveryService');

const SF_ID_REGEX = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/;

const router = express.Router();

// --- Schemas ---
const initiateSchema = z.object({
  deliveryId: z.string().regex(SF_ID_REGEX, 'Invalid Salesforce ID'),
  provider: z.enum(['orange_money', 'mtn_momo']),
  phone: z.string().min(9).max(15),
  amount: z.number().positive(),
});

const checkStatusSchema = z.object({
  provider: z.enum(['orange_money', 'mtn_momo']),
  referenceId: z.string().min(1),
});

/**
 * POST /api/mobile-money/initiate
 * Client initiates a mobile money payment for a delivery.
 */
router.post('/initiate', clientAuth, validateRequest(initiateSchema), async (req, res, next) => {
  try {
    const { deliveryId, provider, phone, amount } = req.body;

    // Verify delivery belongs to client
    const delivery = await deliveryService.findById(deliveryId);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    if (delivery.Sender__c !== req.client.accountId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const orderId = `FD-${deliveryId}-${Date.now()}`;
    const description = `Flash Delivery - ${delivery.Delivery_Reference__c || delivery.Name}`;

    let result;
    if (provider === 'orange_money') {
      result = await mobileMoneyService.initiateOrangeMoneyPayment({
        phone, amount, orderId, description,
      });
    } else {
      result = await mobileMoneyService.initiateMtnPayment({
        phone, amount, orderId, description,
      });
    }

    // Create a pending payment record in Salesforce
    const paymentId = await paymentService.create({
      accountId: req.client.accountId,
      amount,
      deliveryId,
      status: 'Pending',
      type: 'Income',
      label: description,
      incomeCategory: 'Delivery',
    });

    res.json({
      paymentId,
      provider,
      referenceId: result.payToken || result.referenceId,
      paymentUrl: result.paymentUrl || null,
      status: result.status,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/mobile-money/status
 * Check the status of a mobile money payment.
 */
router.post('/status', clientAuth, validateRequest(checkStatusSchema), async (req, res, next) => {
  try {
    const { provider, referenceId } = req.body;

    let result;
    if (provider === 'orange_money') {
      result = await mobileMoneyService.checkOrangeMoneyStatus(referenceId);
    } else {
      result = await mobileMoneyService.checkMtnPaymentStatus(referenceId);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/mobile-money/orange-money/webhook
 * Orange Money payment callback (called by Orange).
 */
router.post('/orange-money/webhook', async (req, res, next) => {
  try {
    const { status, order_id, pay_token, txnid } = req.body;

    if (status === 'SUCCESS' && order_id) {
      // Extract delivery ID from order_id format: FD-{deliveryId}-{timestamp}
      const parts = order_id.split('-');
      if (parts.length >= 2) {
        const deliveryId = parts[1];
        // Find and update the pending payment
        const payments = await paymentService.listByDelivery(deliveryId);
        const pendingPayment = payments.find((p) => p.Status__c === 'Pending');
        if (pendingPayment) {
          await paymentService.updateStatus(pendingPayment.Id, 'Completed');
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/mobile-money/mtn-momo/webhook
 * MTN MoMo payment callback.
 */
router.post('/mtn-momo/webhook', async (req, res, next) => {
  try {
    const { externalId, status } = req.body;

    if (status === 'SUCCESSFUL' && externalId) {
      const parts = externalId.split('-');
      if (parts.length >= 2) {
        const deliveryId = parts[1];
        const payments = await paymentService.listByDelivery(deliveryId);
        const pendingPayment = payments.find((p) => p.Status__c === 'Pending');
        if (pendingPayment) {
          await paymentService.updateStatus(pendingPayment.Id, 'Completed');
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
