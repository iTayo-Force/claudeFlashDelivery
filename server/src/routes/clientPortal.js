const express = require('express');
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const { clientAuth, generateClientTokens } = require('../middleware/clientAuth');
const { authLimiter } = require('../middleware/rateLimiter');
const validateRequest = require('../middleware/validateRequest');
const validateSfIdParam = require('../middleware/validateSfId');
const accountService = require('../services/accountService');
const deliveryService = require('../services/deliveryService');
const paymentService = require('../services/paymentService');
const config = require('../config/env');
const jwt = require('jsonwebtoken');

const router = express.Router();

// --- Auth schemas ---
const googleLoginSchema = z.object({
  idToken: z.string().min(1),
});

const appleLoginSchema = z.object({
  identityToken: z.string().min(1),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const emailRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  phone: z.string().optional(),
  language: z.enum(['French', 'English']).optional(),
});

const emailLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// --- Delivery creation schema ---
const createDeliverySchema = z.object({
  recipientPhone: z.string().min(5).optional(),
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
  phone: z.string().optional(),
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
 * Helper: find or create account from social login data.
 */
async function findOrCreateSocialAccount(email, firstName, lastName) {
  const { escapeString } = require('../utils/soqlSanitizer');
  const { withConnection } = require('../config/salesforce');
  const safeEmail = escapeString(email);

  const account = await withConnection(async (conn) => {
    const result = await conn.query(
      `SELECT Id, FirstName, LastName, PersonEmail FROM Account WHERE PersonEmail = '${safeEmail}' AND IsPersonAccount = true LIMIT 1`
    );
    return result.records[0] || null;
  });

  if (account) return account;

  const accountId = await accountService.create({
    firstName: firstName || 'User',
    lastName: lastName || email.split('@')[0],
    email,
    phoneId: '',
    phone: '',
    language: 'French',
  });

  return { Id: accountId, FirstName: firstName, LastName: lastName, PersonEmail: email };
}

/**
 * POST /api/client/auth/google
 * Login/register with Google ID token.
 */
router.post('/auth/google', authLimiter, validateRequest(googleLoginSchema), async (req, res, next) => {
  try {
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(config.google.clientId);

    const ticket = await client.verifyIdToken({
      idToken: req.body.idToken,
      audience: config.google.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Invalid Google token' });
    }

    const account = await findOrCreateSocialAccount(
      payload.email,
      payload.given_name,
      payload.family_name
    );

    const tokens = generateClientTokens(account.Id, payload.email, 'google');
    res.json({
      ...tokens,
      account: {
        id: account.Id,
        firstName: account.FirstName || payload.given_name,
        lastName: account.LastName || payload.family_name,
        email: payload.email,
      },
    });
  } catch (err) {
    if (err.message?.includes('Token used too late') || err.message?.includes('Invalid token')) {
      return res.status(401).json({ error: 'Invalid or expired Google token' });
    }
    next(err);
  }
});

/**
 * POST /api/client/auth/apple
 * Login/register with Apple identity token.
 * Note: In production, verify the token signature against Apple's public keys
 * at https://appleid.apple.com/auth/keys
 */
router.post('/auth/apple', authLimiter, validateRequest(appleLoginSchema), async (req, res, next) => {
  try {
    const { identityToken, firstName, lastName } = req.body;

    const decoded = jwt.decode(identityToken);
    if (!decoded || !decoded.email) {
      return res.status(400).json({ error: 'Invalid Apple token — no email found' });
    }
    if (decoded.iss !== 'https://appleid.apple.com') {
      return res.status(400).json({ error: 'Invalid Apple token issuer' });
    }
    if (config.apple.clientId && decoded.aud !== config.apple.clientId) {
      return res.status(400).json({ error: 'Invalid Apple token audience' });
    }

    const account = await findOrCreateSocialAccount(
      decoded.email,
      firstName,
      lastName
    );

    const tokens = generateClientTokens(account.Id, decoded.email, 'apple');
    res.json({
      ...tokens,
      account: {
        id: account.Id,
        firstName: account.FirstName || firstName,
        lastName: account.LastName || lastName,
        email: decoded.email,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/client/auth/register
 * Register new account with email and password.
 */
router.post('/auth/register', authLimiter, validateRequest(emailRegisterSchema), async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone, language } = req.body;
    const { escapeString } = require('../utils/soqlSanitizer');
    const { withConnection } = require('../config/salesforce');
    const safeEmail = escapeString(email);

    const existing = await withConnection(async (conn) => {
      const result = await conn.query(
        `SELECT Id FROM Account WHERE PersonEmail = '${safeEmail}' AND IsPersonAccount = true LIMIT 1`
      );
      return result.records[0] || null;
    });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const accountId = await accountService.create({
      firstName,
      lastName,
      email,
      phone: phone || '',
      phoneId: '',
      language: language || 'French',
    });

    // Store password hash on the account
    await withConnection(async (conn) => {
      await conn.sobject('Account').update({
        Id: accountId,
        Password_Hash__c: passwordHash,
        Auth_Provider__c: 'email',
      });
    });

    const tokens = generateClientTokens(accountId, email, 'email');
    res.status(201).json({
      ...tokens,
      account: { id: accountId, firstName, lastName, email },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/client/auth/login
 * Login with email and password.
 */
router.post('/auth/login', authLimiter, validateRequest(emailLoginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { escapeString } = require('../utils/soqlSanitizer');
    const { withConnection } = require('../config/salesforce');
    const safeEmail = escapeString(email);

    const account = await withConnection(async (conn) => {
      const result = await conn.query(
        `SELECT Id, FirstName, LastName, PersonEmail, Password_Hash__c, Language__c
         FROM Account
         WHERE PersonEmail = '${safeEmail}'
         AND IsPersonAccount = true LIMIT 1`
      );
      return result.records[0] || null;
    });

    if (!account || !account.Password_Hash__c) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const valid = await bcrypt.compare(password, account.Password_Hash__c);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const tokens = generateClientTokens(account.Id, email, 'email');
    res.json({
      ...tokens,
      account: {
        id: account.Id,
        firstName: account.FirstName,
        lastName: account.LastName,
        email: account.PersonEmail,
        language: account.Language__c,
      },
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
    const tokens = generateClientTokens(payload.accountId, payload.email, payload.provider);
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
 */
router.get('/profile', clientAuth, async (req, res, next) => {
  try {
    const account = await accountService.findById(req.client.accountId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    res.json({
      id: account.Id,
      firstName: account.FirstName,
      lastName: account.LastName,
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
 */
router.post('/deliveries', clientAuth, validateRequest(createDeliverySchema), async (req, res, next) => {
  try {
    const data = req.body;

    let recipientId = null;
    if (data.recipientPhone) {
      const { validateE164 } = require('../utils/phoneValidator');
      const { valid, formatted } = validateE164(data.recipientPhone);
      if (valid) {
        const recipientAccount = await accountService.findByPhone(formatted);
        if (recipientAccount) recipientId = recipientAccount.Id;
      }
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
 */
router.get('/deliveries/:id', clientAuth, validateSfIdParam(), async (req, res, next) => {
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
 */
router.post('/deliveries/:id/cancel', clientAuth, validateSfIdParam(), async (req, res, next) => {
  try {
    const delivery = await deliveryService.findById(req.params.id);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    if (delivery.Sender__c !== req.client.accountId) {
      return res.status(403).json({ error: 'Only the sender can cancel a delivery' });
    }

    await deliveryService.updateStatus(req.params.id, 'Canceled', {
      cancellationReason: req.body.reason || 'Canceled by sender',
    });
    res.json({ message: 'Delivery canceled' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/client/payments
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
