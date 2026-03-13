const jwt = require('jsonwebtoken');

jest.mock('../src/config/env', () => ({
  jwt: {
    clientSecret: 'test-client-secret-key',
    accessExpiry: '1h',
    refreshExpiry: '7d',
  },
}));

const { clientAuth, generateClientTokens } = require('../src/middleware/clientAuth');

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

const secret = 'test-client-secret-key';

describe('clientAuth middleware', () => {
  test('rejects missing Authorization header', () => {
    const { req, res, next } = mockReqRes(null);
    clientAuth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects invalid token', () => {
    const { req, res, next } = mockReqRes('garbage');
    clientAuth(req, res, next);
    expect(res.statusCode).toBe(401);
  });

  test('rejects employee token type', () => {
    const token = jwt.sign({ type: 'employee', employeeId: '001' }, secret);
    const { req, res, next } = mockReqRes(token);
    clientAuth(req, res, next);
    expect(res.statusCode).toBe(403);
  });

  test('rejects expired token', () => {
    const token = jwt.sign({ type: 'client', accountId: '001', email: 'a@b.c', provider: 'email' }, secret, { expiresIn: '-1s' });
    const { req, res, next } = mockReqRes(token);
    clientAuth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/expired/i);
  });

  test('accepts valid client token and sets req.client', () => {
    const token = jwt.sign({ type: 'client', accountId: '001ABC000000XYZ', email: 'test@example.com', provider: 'google' }, secret);
    const { req, res, next } = mockReqRes(token);
    clientAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.client).toEqual({
      accountId: '001ABC000000XYZ',
      email: 'test@example.com',
      provider: 'google',
    });
  });
});

describe('generateClientTokens', () => {
  test('generates valid access and refresh tokens', () => {
    const tokens = generateClientTokens('001ABC000000XYZ', 'user@test.com', 'apple');
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();

    const access = jwt.verify(tokens.accessToken, secret);
    expect(access.type).toBe('client');
    expect(access.accountId).toBe('001ABC000000XYZ');
    expect(access.email).toBe('user@test.com');
    expect(access.provider).toBe('apple');

    const refresh = jwt.verify(tokens.refreshToken, secret);
    expect(refresh.type).toBe('client_refresh');
  });
});
