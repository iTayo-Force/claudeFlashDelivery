/**
 * Integration tests for Express API routes.
 *
 * These tests use supertest to make real HTTP requests to the Express app,
 * with all service-layer Salesforce calls mocked out.
 */

// Mock config before anything else loads
jest.mock('../src/config/env', () => ({
  jwt: {
    clientSecret: 'test-client-secret',
    employeeSecret: 'test-employee-secret',
    accessExpiry: '1h',
    refreshExpiry: '7d',
  },
  sf: {
    loginUrl: 'https://test.salesforce.com',
    username: 'test@test.com',
    password: 'testpass',
    securityToken: 'testtoken',
  },
  google: { clientId: 'test-google-client-id' },
  apple: { clientId: 'test-apple-client-id' },
  orangeMoney: { clientId: '', clientSecret: '', merchantKey: '' },
  mtnMomo: { subscriptionKey: '', apiUser: '', apiKey: '', environment: 'sandbox', callbackUrl: '' },
  googleMapsApiKey: '',
  port: 0,
  nodeEnv: 'test',
}));

// Mock rate limiter to disable in tests
jest.mock('../src/middleware/rateLimiter', () => ({
  generalLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
}));

// Mock Salesforce connection
jest.mock('../src/config/salesforce', () => ({
  withConnection: jest.fn(),
  getConnection: jest.fn(),
}));

// Mock services
jest.mock('../src/services/accountService');
jest.mock('../src/services/deliveryService');
jest.mock('../src/services/employeeService');
jest.mock('../src/services/paymentService');
jest.mock('../src/services/realtimeService', () => ({
  init: jest.fn(),
  getStats: jest.fn(() => ({ connections: 0, drivers: 0 })),
  broadcastDeliveryUpdate: jest.fn(),
  broadcastDriverLocation: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Must require app after mocks are set up
const app = require('../src/index');
const { withConnection } = require('../src/config/salesforce');
const accountService = require('../src/services/accountService');
const deliveryService = require('../src/services/deliveryService');
const employeeService = require('../src/services/employeeService');
const paymentService = require('../src/services/paymentService');

// Valid Salesforce IDs (15 chars)
const ACCOUNT_ID = '001Te0000000001';
const DELIVERY_ID = 'a01Te0000000001';
const EMPLOYEE_ID = '00ETe0000000001';
const DRIVER_ID = '00ETe0000000002';
const SENDER_ID = '001Te0000000002';

// ---- Token helpers ----
function clientToken(overrides = {}) {
  return jwt.sign(
    { type: 'client', accountId: ACCOUNT_ID, email: 'client@test.com', provider: 'email', ...overrides },
    'test-client-secret',
    { expiresIn: '1h' }
  );
}

function employeeToken(overrides = {}) {
  return jwt.sign(
    { type: 'employee', employeeId: EMPLOYEE_ID, role: 'C-Level', name: 'Admin User', ...overrides },
    'test-employee-secret',
    { expiresIn: '1h' }
  );
}

function driverToken(overrides = {}) {
  return jwt.sign(
    { type: 'employee', employeeId: DRIVER_ID, role: 'Driver', name: 'Driver Bob', ...overrides },
    'test-employee-secret',
    { expiresIn: '1h' }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ==================== HEALTH CHECK ====================
describe('GET /api/health', () => {
  test('returns ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.websocket).toBeDefined();
  });
});

// ==================== CLIENT AUTH ====================
describe('Client Auth', () => {
  describe('POST /api/client/auth/register', () => {
    test('registers a new client', async () => {
      withConnection.mockResolvedValueOnce(null); // no existing account
      accountService.create.mockResolvedValueOnce(ACCOUNT_ID);
      withConnection.mockResolvedValueOnce(undefined); // password hash update

      const res = await request(app)
        .post('/api/client/auth/register')
        .send({
          email: 'new@client.com',
          password: 'securePass123',
          firstName: 'Jean',
          lastName: 'Dupont',
        });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.account.firstName).toBe('Jean');
    });

    test('rejects duplicate email', async () => {
      withConnection.mockResolvedValueOnce({ Id: ACCOUNT_ID }); // existing account

      const res = await request(app)
        .post('/api/client/auth/register')
        .send({
          email: 'existing@client.com',
          password: 'securePass123',
          firstName: 'Jean',
          lastName: 'Dupont',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/);
    });

    test('rejects invalid email format', async () => {
      const res = await request(app)
        .post('/api/client/auth/register')
        .send({
          email: 'not-an-email',
          password: 'securePass123',
          firstName: 'Jean',
          lastName: 'Dupont',
        });

      expect(res.status).toBe(400);
    });

    test('rejects short password', async () => {
      const res = await request(app)
        .post('/api/client/auth/register')
        .send({
          email: 'new@client.com',
          password: 'short',
          firstName: 'Jean',
          lastName: 'Dupont',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/client/auth/login', () => {
    test('logs in with valid credentials', async () => {
      const hash = await bcrypt.hash('correctPassword', 4);
      withConnection.mockResolvedValueOnce({
        Id: ACCOUNT_ID,
        FirstName: 'Jean',
        LastName: 'Dupont',
        PersonEmail: 'jean@test.com',
        Password_Hash__c: hash,
        Language__c: 'French',
      });

      const res = await request(app)
        .post('/api/client/auth/login')
        .send({ email: 'jean@test.com', password: 'correctPassword' });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.account.email).toBe('jean@test.com');
    });

    test('rejects invalid password', async () => {
      const hash = await bcrypt.hash('correctPassword', 4);
      withConnection.mockResolvedValueOnce({
        Id: ACCOUNT_ID,
        Password_Hash__c: hash,
      });

      const res = await request(app)
        .post('/api/client/auth/login')
        .send({ email: 'jean@test.com', password: 'wrongPassword' });

      expect(res.status).toBe(401);
    });

    test('rejects non-existent account', async () => {
      withConnection.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/client/auth/login')
        .send({ email: 'nobody@test.com', password: 'whatever' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/client/auth/refresh', () => {
    test('refreshes client token', async () => {
      const refreshToken = jwt.sign(
        { type: 'client_refresh', accountId: ACCOUNT_ID, email: 'test@test.com', provider: 'email' },
        'test-client-secret',
        { expiresIn: '7d' }
      );

      const res = await request(app)
        .post('/api/client/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });

    test('rejects expired refresh token', async () => {
      const refreshToken = jwt.sign(
        { type: 'client_refresh', accountId: '001', email: 'x@x.com', provider: 'email' },
        'test-client-secret',
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .post('/api/client/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(401);
    });

    test('rejects non-refresh token type', async () => {
      const accessToken = jwt.sign(
        { type: 'client', accountId: '001', email: 'x@x.com', provider: 'email' },
        'test-client-secret',
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .post('/api/client/auth/refresh')
        .send({ refreshToken: accessToken });

      expect(res.status).toBe(401);
    });
  });
});

// ==================== CLIENT PROTECTED ENDPOINTS ====================
describe('Client Protected Endpoints', () => {
  describe('GET /api/client/profile', () => {
    test('returns profile for authenticated client', async () => {
      accountService.findById.mockResolvedValueOnce({
        Id: ACCOUNT_ID,
        FirstName: 'Jean',
        LastName: 'Dupont',
        PersonEmail: 'jean@test.com',
        Language__c: 'French',
      });

      const res = await request(app)
        .get('/api/client/profile')
        .set('Authorization', `Bearer ${clientToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.firstName).toBe('Jean');
      expect(res.body.email).toBe('jean@test.com');
    });

    test('rejects unauthenticated request', async () => {
      const res = await request(app).get('/api/client/profile');
      expect(res.status).toBe(401);
    });

    test('rejects token signed with wrong secret', async () => {
      // Employee token is signed with employeeSecret, clientAuth uses clientSecret
      const res = await request(app)
        .get('/api/client/profile')
        .set('Authorization', `Bearer ${employeeToken()}`);
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/client/profile', () => {
    test('updates profile', async () => {
      accountService.update.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .patch('/api/client/profile')
        .set('Authorization', `Bearer ${clientToken()}`)
        .send({ firstName: 'Pierre' });

      expect(res.status).toBe(200);
      expect(accountService.update).toHaveBeenCalledWith(ACCOUNT_ID, { firstName: 'Pierre' });
    });
  });

  describe('POST /api/client/deliveries', () => {
    test('creates a delivery', async () => {
      deliveryService.create.mockResolvedValueOnce(DELIVERY_ID);
      deliveryService.findById.mockResolvedValueOnce({
        Id: DELIVERY_ID,
        Status__c: 'Ordered',
        Pickup_Location__c: 'Akwa, Douala',
      });

      const res = await request(app)
        .post('/api/client/deliveries')
        .set('Authorization', `Bearer ${clientToken()}`)
        .send({
          pickupLocationName: 'Akwa, Douala',
          pickupLat: 4.0511,
          pickupLng: 9.7679,
          deliveryLocationName: 'Bonabéri, Douala',
          deliveryLat: 4.0700,
          deliveryLng: 9.6900,
        });

      expect(res.status).toBe(201);
      expect(deliveryService.create).toHaveBeenCalledWith(
        expect.objectContaining({ senderId: ACCOUNT_ID })
      );
    });

    test('rejects missing required fields', async () => {
      const res = await request(app)
        .post('/api/client/deliveries')
        .set('Authorization', `Bearer ${clientToken()}`)
        .send({ pickupLocationName: 'Only pickup' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/client/deliveries', () => {
    test('lists client deliveries', async () => {
      deliveryService.listByAccount.mockResolvedValueOnce({
        records: [{ Id: DELIVERY_ID, Status__c: 'Ordered' }],
        totalSize: 1,
      });

      const res = await request(app)
        .get('/api/client/deliveries')
        .set('Authorization', `Bearer ${clientToken()}`);

      expect(res.status).toBe(200);
      expect(deliveryService.listByAccount).toHaveBeenCalledWith(ACCOUNT_ID, expect.any(Object));
    });

    test('passes status filter', async () => {
      deliveryService.listByAccount.mockResolvedValueOnce({ records: [], totalSize: 0 });

      await request(app)
        .get('/api/client/deliveries?status=Delivered')
        .set('Authorization', `Bearer ${clientToken()}`);

      expect(deliveryService.listByAccount).toHaveBeenCalledWith(
        ACCOUNT_ID,
        expect.objectContaining({ status: 'Delivered' })
      );
    });
  });

  describe('GET /api/client/deliveries/:id', () => {
    test('returns delivery owned by client', async () => {
      deliveryService.findById.mockResolvedValueOnce({
        Id: DELIVERY_ID,
        Sender__c: ACCOUNT_ID,
        Status__c: 'Ordered',
      });

      const res = await request(app)
        .get(`/api/client/deliveries/${DELIVERY_ID}`)
        .set('Authorization', `Bearer ${clientToken()}`);

      expect(res.status).toBe(200);
    });

    test('rejects delivery not owned by client', async () => {
      deliveryService.findById.mockResolvedValueOnce({
        Id: DELIVERY_ID,
        Sender__c: SENDER_ID,
        Recipient__c: SENDER_ID,
        Status__c: 'Ordered',
      });

      const res = await request(app)
        .get(`/api/client/deliveries/${DELIVERY_ID}`)
        .set('Authorization', `Bearer ${clientToken()}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/client/deliveries/:id/cancel', () => {
    test('cancels delivery owned by sender', async () => {
      deliveryService.findById.mockResolvedValueOnce({
        Id: DELIVERY_ID,
        Sender__c: ACCOUNT_ID,
        Status__c: 'Ordered',
      });
      deliveryService.updateStatus.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .post(`/api/client/deliveries/${DELIVERY_ID}/cancel`)
        .set('Authorization', `Bearer ${clientToken()}`);

      expect(res.status).toBe(200);
      expect(deliveryService.updateStatus).toHaveBeenCalledWith(
        DELIVERY_ID,
        'Canceled',
        expect.any(Object)
      );
    });

    test('rejects cancel by non-sender', async () => {
      deliveryService.findById.mockResolvedValueOnce({
        Id: DELIVERY_ID,
        Sender__c: SENDER_ID,
        Status__c: 'Ordered',
      });

      const res = await request(app)
        .post(`/api/client/deliveries/${DELIVERY_ID}/cancel`)
        .set('Authorization', `Bearer ${clientToken()}`);

      expect(res.status).toBe(403);
    });
  });
});

// ==================== EMPLOYEE AUTH ====================
describe('Employee Auth', () => {
  describe('POST /api/employees/auth/login', () => {
    test('logs in employee with valid credentials', async () => {
      const hash = await bcrypt.hash('empPassword123', 4);
      withConnection.mockResolvedValueOnce({
        Id: EMPLOYEE_ID,
        Name: 'Admin User',
        First_Name__c: 'Admin',
        Last_Name__c: 'User',
        Email__c: 'admin@flash.cm',
        Title__c: 'C-Level',
        IsActive__c: true,
        Password_Hash__c: hash,
      });

      const res = await request(app)
        .post('/api/employees/auth/login')
        .send({ email: 'admin@flash.cm', password: 'empPassword123' });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.employee.role).toBe('C-Level');
    });

    test('rejects wrong password', async () => {
      const hash = await bcrypt.hash('correct', 4);
      withConnection.mockResolvedValueOnce({
        Id: EMPLOYEE_ID,
        Password_Hash__c: hash,
      });

      const res = await request(app)
        .post('/api/employees/auth/login')
        .send({ email: 'admin@flash.cm', password: 'wrong' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/employees/auth/refresh', () => {
    test('refreshes employee token', async () => {
      const refreshToken = jwt.sign(
        { type: 'employee_refresh', employeeId: EMPLOYEE_ID, role: 'C-Level', name: 'Admin' },
        'test-employee-secret',
        { expiresIn: '7d' }
      );

      const res = await request(app)
        .post('/api/employees/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });
  });
});

// ==================== EMPLOYEE PROTECTED ENDPOINTS ====================
describe('Employee Protected Endpoints', () => {
  describe('GET /api/deliveries', () => {
    test('lists deliveries for authorized employee', async () => {
      deliveryService.list.mockResolvedValueOnce({
        records: [{ Id: DELIVERY_ID }],
        totalSize: 1,
      });

      const res = await request(app)
        .get('/api/deliveries')
        .set('Authorization', `Bearer ${employeeToken()}`);

      expect(res.status).toBe(200);
    });

    test('rejects unauthenticated request', async () => {
      const res = await request(app).get('/api/deliveries');
      expect(res.status).toBe(401);
    });

    test('passes query filters through', async () => {
      deliveryService.list.mockResolvedValueOnce({ records: [], totalSize: 0 });

      await request(app)
        .get('/api/deliveries?status=Ordered&city=Douala')
        .set('Authorization', `Bearer ${employeeToken()}`);

      expect(deliveryService.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Ordered', city: 'Douala' })
      );
    });
  });

  describe('POST /api/deliveries', () => {
    test('creates delivery as employee', async () => {
      deliveryService.create.mockResolvedValueOnce(DELIVERY_ID);
      deliveryService.findById.mockResolvedValueOnce({
        Id: DELIVERY_ID,
        Status__c: 'Ordered',
      });

      const res = await request(app)
        .post('/api/deliveries')
        .set('Authorization', `Bearer ${employeeToken()}`)
        .send({
          senderId: ACCOUNT_ID,
          pickupLocationName: 'Akwa, Douala',
          pickupLat: 4.0511,
          pickupLng: 9.7679,
          deliveryLocationName: 'Bonabéri, Douala',
          deliveryLat: 4.07,
          deliveryLng: 9.69,
        });

      expect(res.status).toBe(201);
    });
  });

  describe('POST /api/deliveries/:id/status', () => {
    test('updates delivery status and broadcasts WebSocket', async () => {
      const realtimeService = require('../src/services/realtimeService');
      deliveryService.updateStatus.mockResolvedValueOnce(undefined);
      deliveryService.findById.mockResolvedValueOnce({
        Id: DELIVERY_ID,
        Status__c: 'Picked up',
        Sender__c: SENDER_ID,
        Driver__c: DRIVER_ID,
      });

      const res = await request(app)
        .post(`/api/deliveries/${DELIVERY_ID}/status`)
        .set('Authorization', `Bearer ${employeeToken()}`)
        .send({ status: 'Picked up' });

      expect(res.status).toBe(200);
      expect(realtimeService.broadcastDeliveryUpdate).toHaveBeenCalledWith(
        DELIVERY_ID,
        expect.objectContaining({ status: 'Picked up' })
      );
    });

    test('creates payment when delivered with amount', async () => {
      deliveryService.updateStatus.mockResolvedValueOnce(undefined);
      deliveryService.findById
        .mockResolvedValueOnce({
          Id: DELIVERY_ID,
          Sender__c: SENDER_ID,
          Delivery_Reference__c: 'DEL-001',
          Name: 'DEL-001',
        })
        .mockResolvedValueOnce({
          Id: DELIVERY_ID,
          Status__c: 'Delivered',
          Sender__c: SENDER_ID,
          Driver__c: DRIVER_ID,
        });
      paymentService.create.mockResolvedValueOnce('a02Te0000000001');
      paymentService.createLineItem.mockResolvedValueOnce('a03Te0000000001');

      const res = await request(app)
        .post(`/api/deliveries/${DELIVERY_ID}/status`)
        .set('Authorization', `Bearer ${employeeToken()}`)
        .send({ status: 'Delivered', amountCollected: 5000 });

      expect(res.status).toBe(200);
      expect(paymentService.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 5000, status: 'Completed' })
      );
    });
  });

  describe('GET /api/employees/me', () => {
    test('returns current employee profile', async () => {
      employeeService.findById.mockResolvedValueOnce({
        Id: EMPLOYEE_ID,
        Name: 'Admin User',
        Title__c: 'C-Level',
      });

      const res = await request(app)
        .get('/api/employees/me')
        .set('Authorization', `Bearer ${employeeToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.Name).toBe('Admin User');
    });
  });

  describe('Role-based access control', () => {
    test('driver cannot access operations', async () => {
      const res = await request(app)
        .get('/api/operations/unassigned')
        .set('Authorization', `Bearer ${driverToken()}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/permissions/i);
    });

    test('driver can access deliveries', async () => {
      deliveryService.list.mockResolvedValueOnce({ records: [], totalSize: 0 });

      const res = await request(app)
        .get('/api/deliveries')
        .set('Authorization', `Bearer ${driverToken()}`);

      expect(res.status).toBe(200);
    });
  });
});

// ==================== SALESFORCE ID VALIDATION ====================
describe('Salesforce ID validation', () => {
  test('rejects invalid Salesforce IDs', async () => {
    const res = await request(app)
      .get('/api/client/deliveries/INVALID-ID!')
      .set('Authorization', `Bearer ${clientToken()}`);

    expect(res.status).toBe(400);
  });

  test('accepts valid 15-char Salesforce ID', async () => {
    deliveryService.findById.mockResolvedValueOnce({
      Id: DELIVERY_ID,
      Sender__c: ACCOUNT_ID,
      Status__c: 'Ordered',
    });

    const res = await request(app)
      .get(`/api/client/deliveries/${DELIVERY_ID}`)
      .set('Authorization', `Bearer ${clientToken()}`);

    expect(res.status).toBe(200);
  });
});
