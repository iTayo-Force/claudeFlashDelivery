const jwt = require('jsonwebtoken');

// Mock config before requiring the module
jest.mock('../src/config/env', () => ({
  jwt: {
    employeeSecret: 'test-employee-secret-key',
    accessExpiry: '1h',
    refreshExpiry: '7d',
  },
}));

const { employeeAuth, requirePermission, generateEmployeeTokens, ROLE_PERMISSIONS } = require('../src/middleware/employeeAuth');

function mockReqRes(token) {
  const req = { headers: {} };
  if (token) req.headers.authorization = `Bearer ${token}`;
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('employeeAuth middleware', () => {
  const secret = 'test-employee-secret-key';

  test('rejects request without Authorization header', () => {
    const { req, res, next } = mockReqRes(null);
    employeeAuth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects invalid token', () => {
    const { req, res, next } = mockReqRes('invalid.token.here');
    employeeAuth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects wrong token type', () => {
    const token = jwt.sign({ type: 'client', accountId: '123' }, secret);
    const { req, res, next } = mockReqRes(token);
    employeeAuth(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects expired token', () => {
    const token = jwt.sign({ type: 'employee', employeeId: '001', role: 'Driver', name: 'Test' }, secret, { expiresIn: '-1s' });
    const { req, res, next } = mockReqRes(token);
    employeeAuth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/expired/i);
  });

  test('accepts valid employee token and sets req.employee', () => {
    const token = jwt.sign({ type: 'employee', employeeId: '001ABC', role: 'Driver', name: 'John' }, secret);
    const { req, res, next } = mockReqRes(token);
    employeeAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.employee).toEqual({ employeeId: '001ABC', role: 'Driver', name: 'John' });
  });
});

describe('requirePermission middleware', () => {
  test('denies when employee not set on request', () => {
    const middleware = requirePermission('operations');
    const { req, res, next } = mockReqRes(null);
    middleware(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('denies Driver access to operations', () => {
    const middleware = requirePermission('operations');
    const req = { employee: { employeeId: '001', role: 'Driver', name: 'D' } };
    const res = { statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(d) { this.body = d; } };
    const next = jest.fn();
    middleware(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('allows Delivery Manager access to operations', () => {
    const middleware = requirePermission('operations');
    const req = { employee: { employeeId: '001', role: 'Delivery Manager', name: 'M' } };
    const res = {};
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('allows C-Level access to all resources', () => {
    const resources = ['dashboard', 'accounts', 'deliveries', 'operations', 'routes', 'tracking', 'employees'];
    resources.forEach((resource) => {
      const middleware = requirePermission(resource);
      const req = { employee: { employeeId: '001', role: 'C-Level', name: 'CEO' } };
      const next = jest.fn();
      middleware(req, {}, next);
      expect(next).toHaveBeenCalled();
    });
  });
});

describe('generateEmployeeTokens', () => {
  test('generates access and refresh tokens', () => {
    const tokens = generateEmployeeTokens('001ABC', 'Driver', 'John');
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();

    const access = jwt.verify(tokens.accessToken, 'test-employee-secret-key');
    expect(access.type).toBe('employee');
    expect(access.employeeId).toBe('001ABC');
    expect(access.role).toBe('Driver');

    const refresh = jwt.verify(tokens.refreshToken, 'test-employee-secret-key');
    expect(refresh.type).toBe('employee_refresh');
  });
});

describe('ROLE_PERMISSIONS', () => {
  test('Driver has minimal permissions', () => {
    expect(ROLE_PERMISSIONS['Driver']).toEqual(['deliveries', 'tracking']);
  });

  test('Sales Rep cannot access operations or routes', () => {
    expect(ROLE_PERMISSIONS['Sales Rep']).not.toContain('operations');
    expect(ROLE_PERMISSIONS['Sales Rep']).not.toContain('routes');
  });
});
