const express = require('express');
const { z } = require('zod');
const { employeeAuth, requirePermission } = require('../middleware/employeeAuth');
const validateRequest = require('../middleware/validateRequest');
const validateSfIdParam = require('../middleware/validateSfId');
const employeeService = require('../services/employeeService');
const deliveryService = require('../services/deliveryService');

const router = express.Router();

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * POST /api/tracking/location
 * Update driver's current GPS location (driver auth).
 */
router.post('/location', employeeAuth, validateRequest(locationSchema), async (req, res, next) => {
  try {
    if (req.employee.role !== 'Driver') {
      return res.status(403).json({ error: 'Only drivers can update location' });
    }
    await employeeService.updateLocation(req.employee.employeeId, req.body.lat, req.body.lng);
    res.json({ message: 'Location updated' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/tracking/drivers
 * Get all active drivers with their current locations (operations staff).
 */
router.get('/drivers', employeeAuth, requirePermission('tracking'), async (req, res, next) => {
  try {
    const drivers = await employeeService.listDrivers();
    const result = drivers
      .filter((d) => d.Current_Location__Latitude__s != null)
      .map((d) => ({
        id: d.Id,
        name: d.Name,
        lat: d.Current_Location__Latitude__s,
        lng: d.Current_Location__Longitude__s,
        updatedAt: d.Current_Location_DateTime__c,
        isStale: d.Current_Location_DateTime__c
          ? (Date.now() - new Date(d.Current_Location_DateTime__c).getTime()) > 30 * 60 * 1000
          : true,
      }));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/tracking/driver/:id
 * Get a specific driver's location and active deliveries.
 */
router.get('/driver/:id', employeeAuth, requirePermission('tracking'), validateSfIdParam(), async (req, res, next) => {
  try {
    const driver = await employeeService.findById(req.params.id);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    const deliveries = await deliveryService.listByDriver(req.params.id, {
      status: undefined, // all active statuses handled in query below
    });

    // Filter to active deliveries only
    const activeDeliveries = deliveries.records.filter((d) =>
      ['Ordered', 'Picked up'].includes(d.Status__c)
    );

    res.json({
      driver: {
        id: driver.Id,
        name: driver.Name,
        mobile: driver.Mobile__c,
        lat: driver.Current_Location__Latitude__s,
        lng: driver.Current_Location__Longitude__s,
        locationUpdatedAt: driver.Current_Location_DateTime__c,
      },
      activeDeliveries,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/tracking/delivery/:id
 * Track a delivery — returns driver location if assigned (client or employee).
 */
router.get('/delivery/:id', validateSfIdParam(), async (req, res, next) => {
  // Accept either client or employee token
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Authentication required' });

  try {
    const delivery = await deliveryService.findById(req.params.id);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    const response = {
      deliveryId: delivery.Id,
      status: delivery.Status__c,
      pickupLocation: {
        name: delivery.Pickup_Location_Name__c,
        lat: delivery.Pickup_Geolocation__Latitude__s,
        lng: delivery.Pickup_Geolocation__Longitude__s,
      },
      deliveryLocation: {
        name: delivery.Delivery_Location_Name__c,
        lat: delivery.Delivery_Geolocation__Latitude__s,
        lng: delivery.Delivery_Geolocation__Longitude__s,
      },
      driver: null,
    };

    // Include driver location if delivery is active and has a driver
    if (delivery.Driver__c && ['Ordered', 'Picked up'].includes(delivery.Status__c)) {
      const driver = await employeeService.findById(delivery.Driver__c);
      if (driver) {
        response.driver = {
          name: driver.Name,
          mobile: driver.Mobile__c,
          lat: driver.Current_Location__Latitude__s,
          lng: driver.Current_Location__Longitude__s,
          locationUpdatedAt: driver.Current_Location_DateTime__c,
        };
      }
    }

    res.json(response);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
