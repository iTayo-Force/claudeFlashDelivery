const express = require('express');
const { z } = require('zod');
const { clientAuth } = require('../middleware/clientAuth');
const { employeeAuth } = require('../middleware/employeeAuth');
const validateRequest = require('../middleware/validateRequest');
const pushNotificationService = require('../services/pushNotificationService');

const router = express.Router();

const registerSchema = z.object({
  pushToken: z.string().min(1),
  platform: z.enum(['ios', 'android', 'web']),
});

/**
 * POST /api/notifications/register
 * Register a push token for the current client.
 */
router.post('/register', clientAuth, validateRequest(registerSchema), async (req, res, next) => {
  try {
    await pushNotificationService.registerToken(
      req.client.accountId,
      req.body.pushToken,
      req.body.platform
    );
    res.json({ message: 'Push token registered' });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/notifications/unregister
 * Deactivate a push token (on logout).
 */
router.delete('/unregister', clientAuth, validateRequest(registerSchema), async (req, res, next) => {
  try {
    await pushNotificationService.deactivateToken(req.body.pushToken);
    res.json({ message: 'Push token deactivated' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
