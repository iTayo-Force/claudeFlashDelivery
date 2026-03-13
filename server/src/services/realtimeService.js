const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

let wss = null;

// Track connected clients by delivery ID and by driver ID
const deliverySubscribers = new Map(); // deliveryId -> Set<ws>
const driverSubscribers = new Map();   // driverId -> Set<ws>

/**
 * Initialize WebSocket server attached to an HTTP server.
 * @param {http.Server} server
 */
function init(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.subscriptions = { deliveryIds: new Set(), driverIds: new Set() };

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        handleMessage(ws, msg);
      } catch {
        ws.send(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });

    ws.on('close', () => {
      cleanupSubscriptions(ws);
    });
  });

  // Heartbeat — terminate stale connections every 30s
  const interval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));
}

/**
 * Handle incoming WebSocket messages.
 */
function handleMessage(ws, msg) {
  switch (msg.type) {
    case 'auth': {
      // Authenticate with JWT (client or employee token)
      try {
        let payload;
        try {
          payload = jwt.verify(msg.token, config.jwt.clientSecret);
          ws.authType = 'client';
        } catch {
          payload = jwt.verify(msg.token, config.jwt.employeeSecret);
          ws.authType = 'employee';
        }
        ws.authenticated = true;
        ws.authPayload = payload;
        ws.send(JSON.stringify({ type: 'auth_ok', authType: ws.authType }));
      } catch {
        ws.send(JSON.stringify({ type: 'auth_error', error: 'Invalid token' }));
      }
      break;
    }

    case 'subscribe_delivery': {
      if (!ws.authenticated) {
        return ws.send(JSON.stringify({ type: 'error', error: 'Not authenticated' }));
      }
      const deliveryId = msg.deliveryId;
      if (!deliveryId || !/^[a-zA-Z0-9]{15,18}$/.test(deliveryId)) {
        return ws.send(JSON.stringify({ type: 'error', error: 'Invalid delivery ID' }));
      }
      if (!deliverySubscribers.has(deliveryId)) {
        deliverySubscribers.set(deliveryId, new Set());
      }
      deliverySubscribers.get(deliveryId).add(ws);
      ws.subscriptions.deliveryIds.add(deliveryId);
      ws.send(JSON.stringify({ type: 'subscribed', channel: 'delivery', id: deliveryId }));
      break;
    }

    case 'subscribe_driver': {
      if (!ws.authenticated || ws.authType !== 'employee') {
        return ws.send(JSON.stringify({ type: 'error', error: 'Employee auth required' }));
      }
      const driverId = msg.driverId;
      if (!driverId || !/^[a-zA-Z0-9]{15,18}$/.test(driverId)) {
        return ws.send(JSON.stringify({ type: 'error', error: 'Invalid driver ID' }));
      }
      if (!driverSubscribers.has(driverId)) {
        driverSubscribers.set(driverId, new Set());
      }
      driverSubscribers.get(driverId).add(ws);
      ws.subscriptions.driverIds.add(driverId);
      ws.send(JSON.stringify({ type: 'subscribed', channel: 'driver', id: driverId }));
      break;
    }

    case 'unsubscribe_delivery': {
      const id = msg.deliveryId;
      deliverySubscribers.get(id)?.delete(ws);
      ws.subscriptions.deliveryIds.delete(id);
      break;
    }

    case 'unsubscribe_driver': {
      const id = msg.driverId;
      driverSubscribers.get(id)?.delete(ws);
      ws.subscriptions.driverIds.delete(id);
      break;
    }

    default:
      ws.send(JSON.stringify({ type: 'error', error: `Unknown message type: ${msg.type}` }));
  }
}

/**
 * Clean up all subscriptions for a disconnected client.
 */
function cleanupSubscriptions(ws) {
  if (!ws.subscriptions) return;
  for (const deliveryId of ws.subscriptions.deliveryIds) {
    deliverySubscribers.get(deliveryId)?.delete(ws);
    if (deliverySubscribers.get(deliveryId)?.size === 0) {
      deliverySubscribers.delete(deliveryId);
    }
  }
  for (const driverId of ws.subscriptions.driverIds) {
    driverSubscribers.get(driverId)?.delete(ws);
    if (driverSubscribers.get(driverId)?.size === 0) {
      driverSubscribers.delete(driverId);
    }
  }
}

/**
 * Broadcast driver location update to all subscribers of that driver
 * and to all subscribers of deliveries assigned to that driver.
 * @param {string} driverId
 * @param {object} location - { lat, lng, timestamp }
 * @param {string[]} activeDeliveryIds - delivery IDs currently assigned to driver
 */
function broadcastDriverLocation(driverId, location, activeDeliveryIds = []) {
  const payload = JSON.stringify({
    type: 'driver_location',
    driverId,
    lat: location.lat,
    lng: location.lng,
    timestamp: location.timestamp || new Date().toISOString(),
  });

  // Notify driver subscribers
  const driverSubs = driverSubscribers.get(driverId);
  if (driverSubs) {
    for (const ws of driverSubs) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }

  // Notify delivery subscribers
  for (const deliveryId of activeDeliveryIds) {
    const deliverySubs = deliverySubscribers.get(deliveryId);
    if (deliverySubs) {
      for (const ws of deliverySubs) {
        if (ws.readyState === 1) ws.send(payload);
      }
    }
  }
}

/**
 * Broadcast delivery status update to subscribers.
 * @param {string} deliveryId
 * @param {object} data - { status, driverId, ... }
 */
function broadcastDeliveryUpdate(deliveryId, data) {
  const subs = deliverySubscribers.get(deliveryId);
  if (!subs || subs.size === 0) return;

  const payload = JSON.stringify({
    type: 'delivery_update',
    deliveryId,
    ...data,
    timestamp: new Date().toISOString(),
  });

  for (const ws of subs) {
    if (ws.readyState === 1) ws.send(payload);
  }
}

/**
 * Get current connection stats.
 */
function getStats() {
  return {
    totalConnections: wss ? wss.clients.size : 0,
    deliverySubscriptions: deliverySubscribers.size,
    driverSubscriptions: driverSubscribers.size,
  };
}

module.exports = {
  init,
  broadcastDriverLocation,
  broadcastDeliveryUpdate,
  getStats,
};
