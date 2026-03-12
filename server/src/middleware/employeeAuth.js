const jwt = require('jsonwebtoken');
const config = require('../config/env');

// Role hierarchy for permission checks
const ROLE_PERMISSIONS = {
  'C-Level': ['dashboard', 'accounts', 'deliveries', 'operations', 'routes', 'tracking', 'employees'],
  'Delivery Manager': ['dashboard', 'accounts', 'deliveries', 'operations', 'routes', 'tracking', 'employees'],
  'Sales Rep': ['dashboard', 'accounts', 'deliveries'],
  'Service Rep': ['dashboard', 'deliveries', 'operations', 'tracking'],
  'Driver': ['deliveries', 'tracking'],
};

/**
 * Middleware to authenticate employee requests via JWT.
 * Sets: req.employee = { employeeId, role, name }
 */
function employeeAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.employeeSecret);
    if (payload.type !== 'employee') {
      return res.status(403).json({ error: 'Invalid token type.' });
    }
    req.employee = {
      employeeId: payload.employeeId,
      role: payload.role,
      name: payload.name,
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
 * Middleware factory to check if employee has access to a specific resource.
 * @param {string} resource - Resource name (e.g., 'operations', 'routes')
 */
function requirePermission(resource) {
  return (req, res, next) => {
    if (!req.employee) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const permissions = ROLE_PERMISSIONS[req.employee.role] || [];
    if (!permissions.includes(resource)) {
      return res.status(403).json({ error: 'Insufficient permissions for this resource.' });
    }
    next();
  };
}

/**
 * Generate JWT tokens for an employee.
 */
function generateEmployeeTokens(employeeId, role, name) {
  const accessToken = jwt.sign(
    { employeeId, role, name, type: 'employee' },
    config.jwt.employeeSecret,
    { expiresIn: config.jwt.accessExpiry }
  );
  const refreshToken = jwt.sign(
    { employeeId, role, name, type: 'employee_refresh' },
    config.jwt.employeeSecret,
    { expiresIn: config.jwt.refreshExpiry }
  );
  return { accessToken, refreshToken };
}

module.exports = { employeeAuth, requirePermission, generateEmployeeTokens, ROLE_PERMISSIONS };
