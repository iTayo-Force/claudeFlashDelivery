const express = require('express');
const { z } = require('zod');
const { employeeAuth, requirePermission } = require('../middleware/employeeAuth');
const validateRequest = require('../middleware/validateRequest');
const validateSfIdParam = require('../middleware/validateSfId');
const deliveryService = require('../services/deliveryService');
const employeeService = require('../services/employeeService');

const router = express.Router();

router.use(employeeAuth, requirePermission('routes'));

const SF_ID_REGEX = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/;

const optimizeSchema = z.object({
  driverId: z.string().regex(SF_ID_REGEX, 'Invalid Salesforce ID'),
  deliveryIds: z.array(z.string().regex(SF_ID_REGEX, 'Invalid Salesforce ID')).min(1).optional(),
});

/**
 * GET /api/routes/driver/:id
 * Get a driver's active delivery route (ordered list of pickups and dropoffs).
 */
router.get('/driver/:id', validateSfIdParam(), async (req, res, next) => {
  try {
    const driver = await employeeService.findById(req.params.id);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    const deliveries = await deliveryService.listByDriver(req.params.id);
    const active = deliveries.records.filter((d) =>
      ['Assigned', 'Picked Up', 'In Transit'].includes(d.Status__c)
    );

    // Build route waypoints ordered by status priority
    const statusOrder = { 'In Transit': 0, 'Picked Up': 1, 'Assigned': 2 };
    active.sort((a, b) => (statusOrder[a.Status__c] || 9) - (statusOrder[b.Status__c] || 9));

    const waypoints = [];
    for (const d of active) {
      if (d.Status__c === 'Assigned') {
        waypoints.push({
          type: 'pickup',
          deliveryId: d.Id,
          name: d.Pickup_Location_Name__c,
          lat: d.Pickup_Geolocation__Latitude__s,
          lng: d.Pickup_Geolocation__Longitude__s,
          status: d.Status__c,
        });
      }
      waypoints.push({
        type: 'dropoff',
        deliveryId: d.Id,
        name: d.Delivery_Location_Name__c,
        lat: d.Delivery_Geolocation__Latitude__s,
        lng: d.Delivery_Geolocation__Longitude__s,
        status: d.Status__c,
      });
    }

    res.json({
      driver: {
        id: driver.Id,
        name: driver.Name,
        currentLat: driver.Current_Location__Latitude__s,
        currentLng: driver.Current_Location__Longitude__s,
      },
      waypoints,
      totalDeliveries: active.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/routes/optimize
 * Generate an optimized route order for a driver's deliveries.
 * Uses simple nearest-neighbor heuristic on the server side.
 * (For production, integrate Google Maps Directions/Routes API.)
 */
router.post('/optimize', validateRequest(optimizeSchema), async (req, res, next) => {
  try {
    const { driverId, deliveryIds } = req.body;
    const driver = await employeeService.findById(driverId);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    let deliveries;
    if (deliveryIds) {
      const promises = deliveryIds.map((id) => deliveryService.findById(id));
      deliveries = (await Promise.all(promises)).filter(Boolean);
    } else {
      const result = await deliveryService.listByDriver(driverId);
      deliveries = result.records.filter((d) =>
        ['Assigned', 'Picked Up', 'In Transit'].includes(d.Status__c)
      );
    }

    if (deliveries.length === 0) {
      return res.json({ waypoints: [], totalDistance: 0 });
    }

    // Build all waypoints
    const points = [];
    for (const d of deliveries) {
      if (d.Status__c === 'Assigned') {
        points.push({
          type: 'pickup', deliveryId: d.Id,
          lat: d.Pickup_Geolocation__Latitude__s,
          lng: d.Pickup_Geolocation__Longitude__s,
          name: d.Pickup_Location_Name__c,
        });
      }
      points.push({
        type: 'dropoff', deliveryId: d.Id,
        lat: d.Delivery_Geolocation__Latitude__s,
        lng: d.Delivery_Geolocation__Longitude__s,
        name: d.Delivery_Location_Name__c,
      });
    }

    // Nearest-neighbor ordering from driver's current location
    const startLat = driver.Current_Location__Latitude__s || points[0]?.lat || 0;
    const startLng = driver.Current_Location__Longitude__s || points[0]?.lng || 0;
    const ordered = nearestNeighborSort(startLat, startLng, points);

    res.json({ waypoints: ordered, totalPoints: ordered.length });
  } catch (err) {
    next(err);
  }
});

/**
 * Simple nearest-neighbor sort for waypoints.
 */
function nearestNeighborSort(startLat, startLng, points) {
  const remaining = [...points];
  const ordered = [];
  let currentLat = startLat;
  let currentLng = startLng;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const p = remaining[i];
      if (p.lat == null || p.lng == null) continue;
      const dist = haversineDistance(currentLat, currentLng, p.lat, p.lng);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    const next = remaining.splice(nearestIdx, 1)[0];
    ordered.push(next);
    currentLat = next.lat || currentLat;
    currentLng = next.lng || currentLng;
  }

  return ordered;
}

/**
 * Haversine distance in km.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = router;
