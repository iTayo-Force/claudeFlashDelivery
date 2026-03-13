const express = require('express');
const { z } = require('zod');
const { employeeAuth, requirePermission, generateEmployeeTokens } = require('../middleware/employeeAuth');
const { authLimiter } = require('../middleware/rateLimiter');
const validateRequest = require('../middleware/validateRequest');
const validateSfIdParam = require('../middleware/validateSfId');
const { validateE164 } = require('../utils/phoneValidator');
const employeeService = require('../services/employeeService');
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

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const createSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
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
 * POST /api/employees/auth/request-otp
 */
router.post('/auth/request-otp', authLimiter, validateRequest(requestOtpSchema), async (req, res, next) => {
  try {
    const { valid, formatted, error } = validateE164(req.body.phone);
    if (!valid) return res.status(400).json({ error });

    // Verify employee exists and is active
    const employee = await employeeService.findByMobile(formatted);
    if (!employee) return res.status(404).json({ error: 'Employee not found or inactive' });

    await smsService.sendOtp(formatted);
    res.json({ message: 'OTP sent' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/employees/auth/verify-otp
 */
router.post('/auth/verify-otp', authLimiter, validateRequest(verifyOtpSchema), async (req, res, next) => {
  try {
    const { phone, code } = req.body;
    const { valid: phoneValid, formatted } = validateE164(phone);
    if (!phoneValid) return res.status(400).json({ error: 'Invalid phone number' });

    const { valid, error } = smsService.verifyOtp(formatted, code);
    if (!valid) return res.status(400).json({ error });

    const employee = await employeeService.findByMobile(formatted);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

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
 * List employees (requires employees permission).
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
 * List active drivers.
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
 * Get current employee's profile.
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
 * Create a new employee (managers/c-level only).
 */
router.post('/', employeeAuth, requirePermission('employees'), validateRequest(createSchema), async (req, res, next) => {
  try {
    const data = req.body;
    const { valid, formatted } = validateE164(data.mobile);
    if (!valid) return res.status(400).json({ error: 'Invalid mobile number' });
    data.mobile = formatted;

    const id = await employeeService.create(data);
    const employee = await employeeService.findById(id);
    res.status(201).json(employee);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/employees/:id
 * Update an employee.
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
