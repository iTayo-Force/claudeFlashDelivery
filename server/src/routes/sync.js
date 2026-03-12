const express = require('express');
const { employeeAuth, requirePermission } = require('../middleware/employeeAuth');
const { withConnection } = require('../config/salesforce');

const router = express.Router();

// Sync routes require manager-level access
router.use(employeeAuth, requirePermission('operations'));

/**
 * GET /api/sync/health
 * Check Salesforce connection health.
 */
router.get('/health', async (req, res, next) => {
  try {
    const info = await withConnection(async (conn) => {
      return {
        userId: conn.userInfo.id,
        organizationId: conn.userInfo.organizationId,
        instanceUrl: conn.instanceUrl,
      };
    });
    res.json({ status: 'connected', ...info });
  } catch (err) {
    res.json({ status: 'disconnected', error: err.message });
  }
});

/**
 * GET /api/sync/metadata/:object
 * Get metadata for a Salesforce object (field list, types).
 */
router.get('/metadata/:object', async (req, res, next) => {
  try {
    const objectName = req.params.object;
    const allowed = ['Account', 'Delivery__c', 'Employee__c', 'Payment__c', 'Transaction_LineItem__c'];
    if (!allowed.includes(objectName)) {
      return res.status(400).json({ error: `Object not allowed. Use one of: ${allowed.join(', ')}` });
    }

    const metadata = await withConnection(async (conn) => {
      const desc = await conn.sobject(objectName).describe();
      return {
        name: desc.name,
        label: desc.label,
        fields: desc.fields.map((f) => ({
          name: f.name,
          label: f.label,
          type: f.type,
          length: f.length,
          updateable: f.updateable,
          required: !f.nillable && !f.defaultedOnCreate,
        })),
      };
    });

    res.json(metadata);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sync/counts
 * Get record counts for main objects.
 */
router.get('/counts', async (req, res, next) => {
  try {
    const counts = await withConnection(async (conn) => {
      const [accounts, deliveries, employees, payments] = await Promise.all([
        conn.query("SELECT COUNT() FROM Account WHERE IsPersonAccount = true"),
        conn.query("SELECT COUNT() FROM Delivery__c"),
        conn.query("SELECT COUNT() FROM Employee__c WHERE IsActive__c = true"),
        conn.query("SELECT COUNT() FROM Payment__c"),
      ]);
      return {
        accounts: accounts.totalSize,
        deliveries: deliveries.totalSize,
        employees: employees.totalSize,
        payments: payments.totalSize,
      };
    });
    res.json(counts);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sync/query
 * Execute a read-only SOQL query (for debugging/admin use).
 */
router.post('/query', async (req, res, next) => {
  try {
    const { soql } = req.body;
    if (!soql || typeof soql !== 'string') {
      return res.status(400).json({ error: 'SOQL query required' });
    }

    // Only allow SELECT queries
    if (!soql.trim().toUpperCase().startsWith('SELECT')) {
      return res.status(400).json({ error: 'Only SELECT queries are allowed' });
    }

    const result = await withConnection(async (conn) => {
      return conn.query(soql);
    });

    res.json({
      totalSize: result.totalSize,
      done: result.done,
      records: result.records,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
