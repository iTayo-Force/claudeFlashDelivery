const { withConnection } = require('../config/salesforce');

/**
 * Get delivery statistics for the dashboard.
 */
async function getDeliveryStats({ dateFrom, dateTo, city } = {}) {
  return withConnection(async (conn) => {
    const conditions = [];
    if (dateFrom) conditions.push(`Booking_DateTime__c >= ${dateFrom}T00:00:00Z`);
    if (dateTo) conditions.push(`Booking_DateTime__c <= ${dateTo}T23:59:59Z`);
    if (city) conditions.push(`Delivery_City__c = '${city}'`);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [statusCounts, revenueTotals, avgTimes] = await Promise.all([
      conn.query(
        `SELECT Status__c, COUNT(Id) cnt FROM Delivery__c ${where} GROUP BY Status__c`
      ),
      conn.query(
        `SELECT SUM(AmountFormula__c) totalRevenue, SUM(Amount_collected__c) totalCollected, COUNT(Id) totalDeliveries FROM Delivery__c ${where}`
      ),
      conn.query(
        `SELECT AVG(Pickup_Time_Mins__c) avgPickup, AVG(Delivery_Time_Mins__c) avgDelivery FROM Delivery__c ${where} AND Status__c = 'Delivered'`
      ),
    ]);

    const byStatus = {};
    for (const rec of statusCounts.records) {
      byStatus[rec.Status__c] = rec.cnt;
    }

    const revenue = revenueTotals.records[0] || {};
    const times = avgTimes.records[0] || {};

    return {
      byStatus,
      totalDeliveries: revenue.totalDeliveries || 0,
      totalRevenue: revenue.totalRevenue || 0,
      totalCollected: revenue.totalCollected || 0,
      avgPickupTimeMins: Math.round(times.avgPickup || 0),
      avgDeliveryTimeMins: Math.round(times.avgDelivery || 0),
    };
  });
}

/**
 * Get driver performance stats.
 */
async function getDriverStats({ dateFrom, dateTo } = {}) {
  return withConnection(async (conn) => {
    const conditions = ['Driver__c != null'];
    if (dateFrom) conditions.push(`Booking_DateTime__c >= ${dateFrom}T00:00:00Z`);
    if (dateTo) conditions.push(`Booking_DateTime__c <= ${dateTo}T23:59:59Z`);
    const where = conditions.join(' AND ');

    const result = await conn.query(
      `SELECT Driver__c, Driver__r.Name,
        COUNT(Id) totalDeliveries,
        SUM(AmountFormula__c) totalRevenue,
        AVG(Delivery_Time_Mins__c) avgDeliveryTime
       FROM Delivery__c
       WHERE ${where}
       GROUP BY Driver__c, Driver__r.Name
       ORDER BY COUNT(Id) DESC`
    );

    return result.records.map((r) => ({
      driverId: r.Driver__c,
      driverName: r.Driver__r?.Name,
      totalDeliveries: r.totalDeliveries,
      totalRevenue: r.totalRevenue || 0,
      avgDeliveryTimeMins: Math.round(r.avgDeliveryTime || 0),
    }));
  });
}

/**
 * Get revenue breakdown by city.
 */
async function getRevenueByCity({ dateFrom, dateTo } = {}) {
  return withConnection(async (conn) => {
    const conditions = [];
    if (dateFrom) conditions.push(`Booking_DateTime__c >= ${dateFrom}T00:00:00Z`);
    if (dateTo) conditions.push(`Booking_DateTime__c <= ${dateTo}T23:59:59Z`);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await conn.query(
      `SELECT Delivery_City__c, COUNT(Id) cnt, SUM(AmountFormula__c) revenue
       FROM Delivery__c ${where}
       GROUP BY Delivery_City__c`
    );

    return result.records.map((r) => ({
      city: r.Delivery_City__c,
      count: r.cnt,
      revenue: r.revenue || 0,
    }));
  });
}

/**
 * Get recent account activity summary.
 */
async function getAccountStats() {
  return withConnection(async (conn) => {
    const [totalAccounts, activeAccounts] = await Promise.all([
      conn.query("SELECT COUNT() FROM Account WHERE IsPersonAccount = true"),
      conn.query(
        `SELECT COUNT() FROM Account WHERE IsPersonAccount = true AND Last_Sent_Delivery__c >= LAST_N_DAYS:30`
      ),
    ]);
    return {
      totalAccounts: totalAccounts.totalSize,
      activeLastMonth: activeAccounts.totalSize,
    };
  });
}

module.exports = { getDeliveryStats, getDriverStats, getRevenueByCity, getAccountStats };
