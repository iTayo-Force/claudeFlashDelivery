const express = require('express');
const { z } = require('zod');
const { clientAuth, generateClientTokens } = require('../middleware/clientAuth');
const { authLimiter } = require('../middleware/rateLimiter');
const validateRequest = require('../middleware/validateRequest');
const { validateE164 } = require('../utils/phoneValidator');
const accountService = require('../services/accountService');
const deliveryService = require('../services/deliveryService');
const paymentService = require('../services/paymentService');
const smsService = require('../services/smsService');
const config = require('../config/env');
const jwt = require('jsonwebtoken');

const router = express.Router();

// --- Auth schemas ---
const requestOtpSchema = z.object({
  phone: z.string().min(5),
});

const verifyOtpSchema = z.object({
  phone: z.string().min(5),
  code: z.string().length(6),
});

const registerSchema = z.object({
  phone: z.string().min(5),
  code: z.string().length(6),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email().optional(),
  language: z.enum(['French', 'English']).optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// --- Delivery creation schema ---
const createDeliverySchema = z.object({
  recipientPhone: z.string().min(5),
  recipientName: z.string().optional(),
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
});

// --- Profile update schema ---
const updateProfileSchema = z.object({
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
});

// ==================== AUTH ENDPOINTS ====================

/**
 * POST /api/client/auth/request-otp
 * Send OTP to phone number.
 */
router.post('/auth/request-otp', authLimiter, validateRequest(requestOtpSchema), async (req, res, next) => {
  try {
    const { phone } = req.body;
    const { valid, formatted, error } = validateE164(phone);
    if (!valid) return res.status(400).json({ error });

    await smsService.sendOtp(formatted);
    res.json({ message: 'OTP sent', phone: formatted });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/client/auth/verify-otp
 * Verify OTP and return tokens (login existing user).
 */
router.post('/auth/verify-otp', authLimiter, validateRequest(verifyOtpSchema), async (req, res, next) => {
  try {
    const { phone, code } = req.body;
    const { valid: phoneValid, formatted } = validateE164(phone);
    if (!phoneValid) return res.status(400).json({ error: 'Invalid phone number' });

    const { valid, error } = smsService.verifyOtp(formatted, code);
    if (!valid) return res.status(400).json({ error });

    const account = await accountService.findByPhone(formatted);
    if (!account) {
      return res.status(404).json({
        error: 'Account not found. Please register first.',
        needsRegistration: true,
        phone: formatted,
      });
    }

    const tokens = generateClientTokens(account.Id, formatted);
    res.json({
      ...tokens,
      account: {
        id: account.Id,
        firstName: account.FirstName,
        lastName: account.LastName,
        phone: formatted,
        email: account.PersonEmail,
        language: account.Language__c,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/client/auth/register
 * Register new account after OTP verification.
 */
router.post('/auth/register', authLimiter, validateRequest(registerSchema), async (req, res, next) => {
  try {
    const { phone, code, firstName, lastName, email, language } = req.body;
    const { valid: phoneValid, formatted } = validateE164(phone);
    if (!phoneValid) return res.status(400).json({ error: 'Invalid phone number' });

    const { valid, error } = smsService.verifyOtp(formatted, code);
    if (!valid) return res.status(400).json({ error });

    // Check if account already exists
    const existing = await accountService.findByPhone(formatted);
    if (existing) {
      return res.status(409).json({ error: 'Account already exists with this phone number.' });
    }

    const accountId = await accountService.create({
      firstName,
      lastName,
      phone: `+${formatted}`,
      phoneId: formatted,
      email,
      language: language || 'French',
    });

    const tokens = generateClientTokens(accountId, formatted);
    res.status(201).json({
      ...tokens,
      account: { id: accountId, firstName, lastName, phone: formatted },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/client/auth/refresh
 * Refresh access token.
 */
router.post('/auth/refresh', validateRequest(refreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const payload = jwt.verify(refreshToken, config.jwt.clientSecret);
    if (payload.type !== 'client_refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    const tokens = generateClientTokens(payload.accountId, payload.phone);
    res.json(tokens);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token expired. Please log in again.' });
    }
    next(err);
  }
});

// ==================== PROTECTED ENDPOINTS ====================

/**
 * GET /api/client/profile
 * Get current client's profile.
 */
router.get('/profile', clientAuth, async (req, res, next) => {
  try {
    const account = await accountService.findById(req.client.accountId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    res.json({
      id: account.Id,
      firstName: account.FirstName,
      lastName: account.LastName,
      phone: req.client.phone,
      email: account.PersonEmail,
      language: account.Language__c,
      mainPickupLocation: account.Main_Pickup_Location__c,
      mainPickupLat: account.Main_Pickup_GeoLocation__Latitude__s,
      mainPickupLng: account.Main_Pickup_GeoLocation__Longitude__s,
      mainDeliveryLocation: account.Main_Delivery_Location__c,
      mainDeliveryLat: account.Main_Delivery_GeoLocation__Latitude__s,
      mainDeliveryLng: account.Main_Delivery_GeoLocation__Longitude__s,
      deliveryRevenue: account.Delivery_Revenue__c,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/client/profile
 * Update current client's profile.
 */
router.patch('/profile', clientAuth, validateRequest(updateProfileSchema), async (req, res, next) => {
  try {
    await accountService.update(req.client.accountId, req.body);
    res.json({ message: 'Profile updated' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/client/deliveries
 * Create a new delivery request.
 */
router.post('/deliveries', clientAuth, validateRequest(createDeliverySchema), async (req, res, next) => {
  try {
    const data = req.body;
    const { valid, formatted } = validateE164(data.recipientPhone);
    if (!valid) return res.status(400).json({ error: 'Invalid recipient phone number' });

    // Find or note recipient account
    let recipientId = null;
    const recipientAccount = await accountService.findByPhone(formatted);
    if (recipientAccount) {
      recipientId = recipientAccount.Id;
    }

    const deliveryId = await deliveryService.create({
      senderId: req.client.accountId,
      recipientId,
      pickupLocationName: data.pickupLocationName,
      pickupLat: data.pickupLat,
      pickupLng: data.pickupLng,
      deliveryLocationName: data.deliveryLocationName,
      deliveryLat: data.deliveryLat,
      deliveryLng: data.deliveryLng,
      description: data.description,
      comment: data.comment,
      type: data.type,
      paymentMethod: data.paymentMethod,
      deliveryDateTime: data.deliveryDateTime,
    });

    const delivery = await deliveryService.findById(deliveryId);
    res.status(201).json(delivery);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/client/deliveries
 * List client's deliveries (as sender or recipient).
 */
router.get('/deliveries', clientAuth, async (req, res, next) => {
  try {
    const { status, limit, offset } = req.query;
    const result = await deliveryService.listByAccount(req.client.accountId, {
      status,
      limit: parseInt(limit, 10) || 20,
      offset: parseInt(offset, 10) || 0,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/client/deliveries/:id
 * Get a specific delivery (only if client is sender or recipient).
 */
router.get('/deliveries/:id', clientAuth, async (req, res, next) => {
  try {
    const delivery = await deliveryService.findById(req.params.id);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    if (delivery.Sender__c !== req.client.accountId && delivery.Recipient__c !== req.client.accountId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(delivery);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/client/deliveries/:id/cancel
 * Cancel a delivery (only sender, only if status allows).
 */
router.post('/deliveries/:id/cancel', clientAuth, async (req, res, next) => {
  try {
    const delivery = await deliveryService.findById(req.params.id);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    if (delivery.Sender__c !== req.client.accountId) {
      return res.status(403).json({ error: 'Only the sender can cancel a delivery' });
    }

    await deliveryService.updateStatus(req.params.id, 'Cancelled', {
      cancellationReason: req.body.reason || 'Cancelled by sender',
    });
    res.json({ message: 'Delivery cancelled' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/client/payments
 * List client's payments.
 */
router.get('/payments', clientAuth, async (req, res, next) => {
  try {
    const { status, limit, offset } = req.query;
    const result = await paymentService.listByAccount(req.client.accountId, {
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
