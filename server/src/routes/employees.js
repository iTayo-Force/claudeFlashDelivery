const express = require('express');
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const { employeeAuth, requirePermission, generateEmployeeTokens } = require('../middleware/employeeAuth');
const { authLimiter } = require('../middleware/rateLimiter');
const validateRequest = require('../middleware/validateRequest');
const validateSfIdParam = require('../middleware/validateSfId');
const { validateE164 } = require('../utils/phoneValidator');
const { escapeString } = require('../utils/soqlSanitizer');
const employeeService = require('../services/employeeService');
const config = require('../config/env');
const jwt = require('jsonwebtoken');

const router = express.Router();

// --- Auth schemas ---
const emailLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const setPasswordSchema = z.object({
  email: z.string().email(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const createSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  mobile: z.string().min(5),
  title: z.enum(['C-Level', 'Delivery Manager', 'Sales Rep', 'Service Rep', 'Driver']),
  salutation: z.string().optional(),
  birthday: z.string().optional(),
  company: z.string().optional(),
  customerService: z.boolean().optional(),
});

const updateSchema = z.object({
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  email: z.string().email().optional(),
  mobile: z.string().optional(),
  title: z.enum(['C-Level', 'Delivery Manager', 'Sales Rep', 'Service Rep', 'Driver']).optional(),
  isActive: z.boolean().optional(),
  customerService: z.boolean().optional(),
});

// ==================== AUTH (public) ====================

/**
 * POST /api/employees/auth/login
 * Employee login with email and password.
 */
router.post('/auth/login', authLimiter, validateRequest(emailLoginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const safeEmail = escapeString(email);

    const { withConnection } = require('../config/salesforce');
    const employee = await withConnection(async (conn) => {
      const result = await conn.query(
        `SELECT Id, Name, First_Name__c, Last_Name__c, Email__c, Title__c, IsActive__c, Password_Hash__c
         FROM Employee__c
         WHERE Email__c = '${safeEmail}' AND IsActive__c = true LIMIT 1`
      );
      return result.records[0] || null;
    });

    if (!employee || !employee.Password_Hash__c) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const valid = await bcrypt.compare(password, employee.Password_Hash__c);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const tokens = generateEmployeeTokens(employee.Id, employee.Title__c, employee.Name);
    res.json({
      ...tokens,
      employee: {
        id: employee.Id,
        name: employee.Name,
        role: employee.Title__c,
        email: employee.Email__c,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/employees/auth/set-password
 * Set or change employee password.
 * First-time setup: no currentPassword needed.
 * Password change: currentPassword required.
 */
router.post('/auth/set-password', authLimiter, validateRequest(setPasswordSchema), async (req, res, next) => {
  try {
    const { email, currentPassword, newPassword } = req.body;
    const safeEmail = escapeString(email);

    const { withConnection } = require('../config/salesforce');
    const employee = await withConnection(async (conn) => {
      const result = await conn.query(
        `SELECT Id, Password_Hash__c, IsActive__c FROM Employee__c WHERE Email__c = '${safeEmail}' AND IsActive__c = true LIMIT 1`
      );
      return result.records[0] || null;
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found or inactive.' });
    }

    if (employee.Password_Hash__c) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to change password.' });
      }
      const valid = await bcrypt.compare(currentPassword, employee.Password_Hash__c);
      if (!valid) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await withConnection(async (conn) => {
      await conn.sobject('Employee__c').update({
        Id: employee.Id,
        Password_Hash__c: passwordHash,
      });
    });

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/employees/auth/refresh
 */
router.post('/auth/refresh', validateRequest(refreshSchema), async (req, res, next) => {
  try {
    const payload = jwt.verify(req.body.refreshToken, config.jwt.employeeSecret);
    if (payload.type !== 'employee_refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    const tokens = generateEmployeeTokens(payload.employeeId, payload.role, payload.name);
    res.json(tokens);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    next(err);
  }
});

// ==================== PROTECTED (employees resource) ====================

/**
 * GET /api/employees
 */
router.get('/', employeeAuth, requirePermission('employees'), async (req, res, next) => {
  try {
    const { role, active, limit, offset } = req.query;
    const result = await employeeService.list({
      role,
      active: active != null ? active === 'true' : undefined,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/employees/drivers
 */
router.get('/drivers', employeeAuth, requirePermission('employees'), async (req, res, next) => {
  try {
    const drivers = await employeeService.listDrivers();
    res.json(drivers);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/employees/me
 */
router.get('/me', employeeAuth, async (req, res, next) => {
  try {
    const employee = await employeeService.findById(req.employee.employeeId);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    res.json(employee);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/employees/:id
 */
router.get('/:id', employeeAuth, requirePermission('employees'), validateSfIdParam(), async (req, res, next) => {
  try {
    const employee = await employeeService.findById(req.params.id);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    res.json(employee);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/employees
 * Create a new employee with email/password (managers/c-level only).
 */
router.post('/', employeeAuth, requirePermission('employees'), validateRequest(createSchema), async (req, res, next) => {
  try {
    const data = req.body;
    const { valid, formatted } = validateE164(data.mobile);
    if (!valid) return res.status(400).json({ error: 'Invalid mobile number' });
    data.mobile = formatted;

    const id = await employeeService.create(data);

    // Set the password for the new employee
    const passwordHash = await bcrypt.hash(data.password, 12);
    const { withConnection } = require('../config/salesforce');
    await withConnection(async (conn) => {
      await conn.sobject('Employee__c').update({
        Id: id,
        Password_Hash__c: passwordHash,
      });
    });

    const employee = await employeeService.findById(id);
    res.status(201).json(employee);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/employees/:id
 */
router.patch('/:id', employeeAuth, requirePermission('employees'), validateSfIdParam(), validateRequest(updateSchema), async (req, res, next) => {
  try {
    await employeeService.update(req.params.id, req.body);
    const employee = await employeeService.findById(req.params.id);
    res.json(employee);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
