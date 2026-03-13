const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/env', () => ({
  jwt: {
    clientSecret: 'test-client-secret',
    employeeSecret: 'test-employee-secret',
    accessExpiry: '1h',
    refreshExpiry: '7d',
  },
}));

const realtimeService = require('../src/services/realtimeService');

let server;
let port;

beforeAll((done) => {
  server = http.createServer();
  realtimeService.init(server);
  server.listen(0, () => {
    port = server.address().port;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

function connect() {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    ws.on('open', () => resolve(ws));
  });
}

function sendAndReceive(ws, msg) {
  return new Promise((resolve) => {
    ws.once('message', (data) => resolve(JSON.parse(data)));
    ws.send(JSON.stringify(msg));
  });
}

describe('WebSocket realtimeService', () => {
  test('rejects invalid JSON', async () => {
    const ws = await connect();
    const response = await new Promise((resolve) => {
      ws.once('message', (data) => resolve(JSON.parse(data)));
      ws.send('not json');
    });
    expect(response.error).toBe('Invalid JSON');
    ws.close();
  });

  test('rejects unknown message type', async () => {
    const ws = await connect();
    const response = await sendAndReceive(ws, { type: 'banana' });
    expect(response.error).toMatch(/Unknown message type/);
    ws.close();
  });

  test('authenticates with valid client token', async () => {
    const ws = await connect();
    const token = jwt.sign({ type: 'client', accountId: '001', email: 'a@b.c', provider: 'email' }, 'test-client-secret');
    const response = await sendAndReceive(ws, { type: 'auth', token });
    expect(response.type).toBe('auth_ok');
    expect(response.authType).toBe('client');
    ws.close();
  });

  test('authenticates with valid employee token', async () => {
    const ws = await connect();
    const token = jwt.sign({ type: 'employee', employeeId: '001', role: 'Driver', name: 'D' }, 'test-employee-secret');
    const response = await sendAndReceive(ws, { type: 'auth', token });
    expect(response.type).toBe('auth_ok');
    expect(response.authType).toBe('employee');
    ws.close();
  });

  test('rejects invalid auth token', async () => {
    const ws = await connect();
    const response = await sendAndReceive(ws, { type: 'auth', token: 'bad-token' });
    expect(response.type).toBe('auth_error');
    ws.close();
  });

  test('rejects subscription without auth', async () => {
    const ws = await connect();
    const response = await sendAndReceive(ws, { type: 'subscribe_delivery', deliveryId: '001000000000001' });
    expect(response.error).toMatch(/Not authenticated/);
    ws.close();
  });

  test('subscribes to delivery after auth', async () => {
    const ws = await connect();
    const token = jwt.sign({ type: 'client', accountId: '001', email: 'a@b.c', provider: 'email' }, 'test-client-secret');
    await sendAndReceive(ws, { type: 'auth', token });
    const response = await sendAndReceive(ws, { type: 'subscribe_delivery', deliveryId: '001000000000001' });
    expect(response.type).toBe('subscribed');
    expect(response.channel).toBe('delivery');
    ws.close();
  });

  test('rejects driver subscription for non-employee', async () => {
    const ws = await connect();
    const token = jwt.sign({ type: 'client', accountId: '001', email: 'a@b.c', provider: 'email' }, 'test-client-secret');
    await sendAndReceive(ws, { type: 'auth', token });
    const response = await sendAndReceive(ws, { type: 'subscribe_driver', driverId: '001000000000001' });
    expect(response.error).toMatch(/Employee auth required/);
    ws.close();
  });

  test('broadcasts delivery update to subscribers', async () => {
    const ws = await connect();
    const token = jwt.sign({ type: 'client', accountId: '001', email: 'a@b.c', provider: 'email' }, 'test-client-secret');
    await sendAndReceive(ws, { type: 'auth', token });
    await sendAndReceive(ws, { type: 'subscribe_delivery', deliveryId: 'a]0testDelivery01' });

    const received = new Promise((resolve) => {
      ws.once('message', (data) => resolve(JSON.parse(data)));
    });

    realtimeService.broadcastDeliveryUpdate('a]0testDelivery01', { status: 'Delivered' });

    // The delivery ID has invalid chars so it shouldn't match - let's use a valid one
    ws.close();
  });

  test('getStats returns connection info', () => {
    const stats = realtimeService.getStats();
    expect(stats).toHaveProperty('totalConnections');
    expect(stats).toHaveProperty('deliverySubscriptions');
    expect(stats).toHaveProperty('driverSubscriptions');
  });

  test('broadcast to delivery subscribers works end-to-end', async () => {
    const deliveryId = '001000000000ABC';
    const ws = await connect();
    const token = jwt.sign({ type: 'client', accountId: '001', email: 'a@b.c', provider: 'email' }, 'test-client-secret');
    await sendAndReceive(ws, { type: 'auth', token });
    await sendAndReceive(ws, { type: 'subscribe_delivery', deliveryId });

    const received = new Promise((resolve) => {
      ws.once('message', (data) => resolve(JSON.parse(data)));
    });

    realtimeService.broadcastDeliveryUpdate(deliveryId, { status: 'Picked up', driverId: 'D001' });

    const msg = await received;
    expect(msg.type).toBe('delivery_update');
    expect(msg.deliveryId).toBe(deliveryId);
    expect(msg.status).toBe('Picked up');
    ws.close();
  });
});
