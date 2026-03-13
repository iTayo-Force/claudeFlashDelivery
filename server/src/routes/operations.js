const express = require('express');
const { z } = require('zod');
const { employeeAuth, requirePermission } = require('../middleware/employeeAuth');
const validateRequest = require('../middleware/validateRequest');
const validateSfIdParam = require('../middleware/validateSfId');
const deliveryService = require('../services/deliveryService');
const employeeService = require('../services/employeeService');

const SF_ID_REGEX = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/;

const router = express.Router();

router.use(employeeAuth, requirePermission('operations'));

const assignSchema = z.object({
  driverId: z.string().regex(SF_ID_REGEX, 'Invalid Salesforce ID'),
  deliveryManagerId: z.string().regex(SF_ID_REGEX, 'Invalid Salesforce ID').optional(),
  salesRepId: z.string().regex(SF_ID_REGEX, 'Invalid Salesforce ID').optional(),
});

const bulkAssignSchema = z.object({
  deliveryIds: z.array(z.string().regex(SF_ID_REGEX, 'Invalid Salesforce ID')).min(1).max(50),
  driverId: z.string().regex(SF_ID_REGEX, 'Invalid Salesforce ID'),
});

/**
 * GET /api/operations/unassigned
 * List deliveries that are missing driver/manager assignment.
 */
router.get('/unassigned', async (req, res, next) => {
  try {
    const result = await deliveryService.list({
      status: 'Ordered',
      limit: 100,
      offset: 0,
    });
    // Filter to only those with missing info
    const unassigned = result.records.filter(
      (d) => !d.Driver__c || !d.Delivery_Manager__c
    );
    res.json({ records: unassigned, total: unassigned.length });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/operations/active
 * List all active deliveries (Ordered, Picked up — not yet delivered or canceled).
 */
router.get('/active', async (req, res, next) => {
  try {
    const { withConnection } = require('../config/salesforce');
    const records = await withConnection(async (conn) => {
      const result = await conn.query(
        `SELECT Id, Name, Delivery_Reference__c, Status__c,
          Sender__r.Name, Recipient__r.Name,
          Pickup_Location_Name__c, Delivery_Location_Name__c,
          Driver__r.Name, Driver__c,
          Booking_DateTime__c, Delivery_DateTime__c
         FROM Delivery__c
         WHERE Status__c IN ('Ordered', 'Picked up')
         ORDER BY Booking_DateTime__c ASC
         LIMIT 200`
      );
      return result.records;
    });
    res.json({ records, total: records.length });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/operations/assign/:id
 * Assign driver/manager to a delivery.
 */
router.post('/assign/:id', validateSfIdParam(), validateRequest(assignSchema), async (req, res, next) => {
  try {
    const { driverId, deliveryManagerId, salesRepId } = req.body;

    await deliveryService.update(req.params.id, {
      driverId,
      deliveryManagerId,
      salesRepId,
    });

    const delivery = await deliveryService.findById(req.params.id);

    const updated = await deliveryService.findById(req.params.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/operations/bulk-assign
 * Assign a driver to multiple deliveries at once.
 */
router.post('/bulk-assign', validateRequest(bulkAssignSchema), async (req, res, next) => {
  try {
    const { deliveryIds, driverId } = req.body;
    const results = [];

    for (const id of deliveryIds) {
      try {
        await deliveryService.update(id, { driverId });
        results.push({ id, success: true });
      } catch (err) {
        results.push({ id, success: false, error: err.message });
      }
    }

    res.json({ results });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/operations/drivers-availability
 * List drivers with their current assignment counts.
 */
router.get('/drivers-availability', async (req, res, next) => {
  try {
    const drivers = await employeeService.listDrivers();
    const { withConnection } = require('../config/salesforce');

    if (drivers.length === 0) return res.json([]);
    // IDs come from Salesforce query results (trusted), but validate format as defense-in-depth
    const driverIds = drivers
      .filter((d) => /^[a-zA-Z0-9]{15,18}$/.test(d.Id))
      .map((d) => `'${d.Id}'`)
      .join(',');
    if (!driverIds) return res.json([]);

    const counts = await withConnection(async (conn) => {
      const result = await conn.query(
        `SELECT Driver__c, COUNT(Id) cnt
         FROM Delivery__c
         WHERE Driver__c IN (${driverIds})
         AND Status__c IN ('Ordered', 'Picked up')
         GROUP BY Driver__c`
      );
      return result.records;
    });

    const countMap = {};
    for (const r of counts) {
      countMap[r.Driver__c] = r.cnt;
    }

    const result = drivers.map((d) => ({
      id: d.Id,
      name: d.Name,
      mobile: d.Mobile__c,
      currentLocation: {
        lat: d.Current_Location__Latitude__s,
        lng: d.Current_Location__Longitude__s,
        updatedAt: d.Current_Location_DateTime__c,
      },
      activeDeliveries: countMap[d.Id] || 0,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
