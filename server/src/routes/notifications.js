const express = require('express');
const { z } = require('zod');
const { employeeAuth } = require('../middleware/employeeAuth');
const validateRequest = require('../middleware/validateRequest');
const smsService = require('../services/smsService');
const deliveryService = require('../services/deliveryService');
const accountService = require('../services/accountService');
const { formatForDisplay } = require('../utils/phoneValidator');

const router = express.Router();

router.use(employeeAuth);

const sendSmsSchema = z.object({
  phone: z.string().min(5),
  message: z.string().min(1).max(160),
});

const SF_ID_REGEX = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/;

const deliveryNotifySchema = z.object({
  deliveryId: z.string().regex(SF_ID_REGEX, 'Invalid Salesforce ID'),
  type: z.enum(['pickup_ready', 'in_transit', 'delivered', 'cancelled']),
  customMessage: z.string().max(160).optional(),
});

/**
 * POST /api/notifications/sms
 * Send a custom SMS (employee use).
 */
router.post('/sms', validateRequest(sendSmsSchema), async (req, res, next) => {
  try {
    await smsService.sendSms(req.body.phone, req.body.message);
    res.json({ message: 'SMS sent' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/notifications/delivery
 * Send a delivery status notification to sender/recipient.
 */
router.post('/delivery', validateRequest(deliveryNotifySchema), async (req, res, next) => {
  try {
    const { deliveryId, type, customMessage } = req.body;
    const delivery = await deliveryService.findById(deliveryId);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    const sender = delivery.Sender__c ? await accountService.findById(delivery.Sender__c) : null;
    const recipient = delivery.Recipient__c ? await accountService.findById(delivery.Recipient__c) : null;

    const messages = {
      pickup_ready: (name, ref) =>
        `Flash Delivery: Your delivery ${ref} is ready for pickup. Driver is on the way!`,
      in_transit: (name, ref) =>
        `Flash Delivery: Your delivery ${ref} is now in transit.`,
      delivered: (name, ref) =>
        `Flash Delivery: Your delivery ${ref} has been delivered successfully!`,
      cancelled: (name, ref) =>
        `Flash Delivery: Your delivery ${ref} has been cancelled.`,
    };

    const ref = delivery.Delivery_Reference__c || delivery.Name;
    const msg = customMessage || messages[type]('', ref);
    const sent = [];

    // Notify sender
    if (sender?.PhoneID__c) {
      await smsService.sendSms(sender.PhoneID__c, msg);
      sent.push({ to: 'sender', phone: formatForDisplay(sender.PhoneID__c) });
    }

    // Notify recipient
    if (recipient?.PhoneID__c) {
      await smsService.sendSms(recipient.PhoneID__c, msg);
      sent.push({ to: 'recipient', phone: formatForDisplay(recipient.PhoneID__c) });
    }

    res.json({ message: 'Notifications sent', sent });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
