const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Middleware to authenticate client requests via JWT.
 * Expects: Authorization: Bearer <token>
 * Sets: req.client = { accountId, phone }
 */
function clientAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.clientSecret);
    if (payload.type !== 'client') {
      return res.status(403).json({ error: 'Invalid token type.' });
    }
    req.client = {
      accountId: payload.accountId,
      phone: payload.phone,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

/**
 * Generate JWT tokens for a client.
 */
function generateClientTokens(accountId, phone) {
  const accessToken = jwt.sign(
    { accountId, phone, type: 'client' },
    config.jwt.clientSecret,
    { expiresIn: config.jwt.accessExpiry }
  );
  const refreshToken = jwt.sign(
    { accountId, phone, type: 'client_refresh' },
    config.jwt.clientSecret,
    { expiresIn: config.jwt.refreshExpiry }
  );
  return { accessToken, refreshToken };
}

module.exports = { clientAuth, generateClientTokens };
