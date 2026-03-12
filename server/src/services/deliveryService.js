const { withConnection } = require('../config/salesforce');

const DELIVERY_FIELDS = [
  'Id', 'Name', 'Delivery_Reference__c',
  'Sender__c', 'Sender__r.Name', 'Sender__r.Phone', 'Sender__r.PhoneID__c',
  'Recipient__c', 'Recipient__r.Name', 'Recipient__r.Phone', 'Recipient__r.PhoneID__c',
  'Status__c', 'Type__c', 'Payment_Method__c',
  'Pickup_Location_Name__c', 'Pickup_Geolocation__Latitude__s', 'Pickup_Geolocation__Longitude__s',
  'Delivery_Location_Name__c', 'Delivery_Geolocation__Latitude__s', 'Delivery_Geolocation__Longitude__s',
  'Description__c', 'Comment__c',
  'Distance__c', 'AmountFormula__c', 'Amount_collected__c',
  'Booking_DateTime__c', 'Delivery_DateTime__c', 'Picked_Up_DateTime__c',
  'Delivery_Time_Mins__c', 'Pickup_Time_Mins__c',
  'Driver__c', 'Driver__r.Name', 'Driver__r.Mobile__c',
  'Delivery_Manager__c', 'Sales_Rep__c',
  'Free_Delivery__c', 'Cancelation_Reason__c',
  'Missing_Information__c', 'Delivery_City__c',
].join(', ');

const VALID_STATUSES = ['New', 'Assigned', 'Picked Up', 'In Transit', 'Delivered', 'Cancelled'];

const STATUS_TRANSITIONS = {
  'New': ['Assigned', 'Cancelled'],
  'Assigned': ['Picked Up', 'Cancelled'],
  'Picked Up': ['In Transit', 'Cancelled'],
  'In Transit': ['Delivered', 'Cancelled'],
  'Delivered': [],
  'Cancelled': [],
};

/**
 * Create a new delivery.
 */
async function create(data) {
  return withConnection(async (conn) => {
    const record = {
      Sender__c: data.senderId,
      Recipient__c: data.recipientId,
      Status__c: 'New',
      Type__c: data.type,
      Payment_Method__c: data.paymentMethod,
      Pickup_Location_Name__c: data.pickupLocationName,
      Delivery_Location_Name__c: data.deliveryLocationName,
      Description__c: data.description,
      Comment__c: data.comment,
      Booking_DateTime__c: new Date().toISOString(),
    };

    if (data.pickupLat != null && data.pickupLng != null) {
      record.Pickup_Geolocation__Latitude__s = data.pickupLat;
      record.Pickup_Geolocation__Longitude__s = data.pickupLng;
    }
    if (data.deliveryLat != null && data.deliveryLng != null) {
      record.Delivery_Geolocation__Latitude__s = data.deliveryLat;
      record.Delivery_Geolocation__Longitude__s = data.deliveryLng;
    }
    if (data.deliveryDateTime) record.Delivery_DateTime__c = data.deliveryDateTime;
    if (data.freeDelivery) record.Free_Delivery__c = data.freeDelivery;

    const result = await conn.sobject('Delivery__c').create(record);
    if (!result.success) throw new Error(result.errors?.[0]?.message || 'Failed to create delivery');
    return result.id;
  });
}

/**
 * Get a delivery by Id.
 */
async function findById(deliveryId) {
  return withConnection(async (conn) => {
    const result = await conn.query(
      `SELECT ${DELIVERY_FIELDS} FROM Delivery__c WHERE Id = '${deliveryId}' LIMIT 1`
    );
    return result.records[0] || null;
  });
}

/**
 * Update delivery status with transition validation.
 */
async function updateStatus(deliveryId, newStatus, extras = {}) {
  if (!VALID_STATUSES.includes(newStatus)) {
    const err = new Error(`Invalid status: ${newStatus}`);
    err.statusCode = 400;
    throw err;
  }

  return withConnection(async (conn) => {
    const current = await conn.query(
      `SELECT Id, Status__c FROM Delivery__c WHERE Id = '${deliveryId}' LIMIT 1`
    );
    if (!current.records[0]) {
      const err = new Error('Delivery not found');
      err.statusCode = 404;
      throw err;
    }

    const currentStatus = current.records[0].Status__c;
    const allowed = STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      const err = new Error(`Cannot transition from "${currentStatus}" to "${newStatus}"`);
      err.statusCode = 400;
      throw err;
    }

    const record = { Id: deliveryId, Status__c: newStatus };

    if (newStatus === 'Picked Up') {
      record.Picked_Up_DateTime__c = new Date().toISOString();
    }
    if (newStatus === 'Delivered') {
      record.Delivery_DateTime__c = new Date().toISOString();
      if (extras.amountCollected != null) record.Amount_collected__c = extras.amountCollected;
    }
    if (newStatus === 'Cancelled' && extras.cancellationReason) {
      record.Cancelation_Reason__c = extras.cancellationReason;
    }

    const result = await conn.sobject('Delivery__c').update(record);
    if (!result.success) throw new Error(result.errors?.[0]?.message || 'Failed to update status');
    return result;
  });
}

/**
 * Update delivery fields (assignment, details, etc.).
 */
async function update(deliveryId, data) {
  return withConnection(async (conn) => {
    const record = { Id: deliveryId };
    if (data.driverId) record.Driver__c = data.driverId;
    if (data.deliveryManagerId) record.Delivery_Manager__c = data.deliveryManagerId;
    if (data.salesRepId) record.Sales_Rep__c = data.salesRepId;
    if (data.recipientId) record.Recipient__c = data.recipientId;
    if (data.paymentMethod) record.Payment_Method__c = data.paymentMethod;
    if (data.description) record.Description__c = data.description;
    if (data.comment) record.Comment__c = data.comment;
    if (data.type) record.Type__c = data.type;
    if (data.pickupLocationName) record.Pickup_Location_Name__c = data.pickupLocationName;
    if (data.deliveryLocationName) record.Delivery_Location_Name__c = data.deliveryLocationName;
    if (data.pickupLat != null && data.pickupLng != null) {
      record.Pickup_Geolocation__Latitude__s = data.pickupLat;
      record.Pickup_Geolocation__Longitude__s = data.pickupLng;
    }
    if (data.deliveryLat != null && data.deliveryLng != null) {
      record.Delivery_Geolocation__Latitude__s = data.deliveryLat;
      record.Delivery_Geolocation__Longitude__s = data.deliveryLng;
    }
    if (data.deliveryDateTime) record.Delivery_DateTime__c = data.deliveryDateTime;
    if (data.freeDelivery != null) record.Free_Delivery__c = data.freeDelivery;

    const result = await conn.sobject('Delivery__c').update(record);
    if (!result.success) throw new Error(result.errors?.[0]?.message || 'Failed to update delivery');
    return result;
  });
}

/**
 * List deliveries for a given account (as sender or recipient).
 */
async function listByAccount(accountId, { status, limit = 20, offset = 0 } = {}) {
  return withConnection(async (conn) => {
    let where = `(Sender__c = '${accountId}' OR Recipient__c = '${accountId}')`;
    if (status) where += ` AND Status__c = '${status}'`;

    const countResult = await conn.query(`SELECT COUNT() FROM Delivery__c WHERE ${where}`);
    const result = await conn.query(
      `SELECT ${DELIVERY_FIELDS} FROM Delivery__c WHERE ${where} ORDER BY Booking_DateTime__c DESC LIMIT ${limit} OFFSET ${offset}`
    );
    return { records: result.records, total: countResult.totalSize };
  });
}

/**
 * List deliveries assigned to a driver.
 */
async function listByDriver(employeeId, { status, limit = 20, offset = 0 } = {}) {
  return withConnection(async (conn) => {
    let where = `Driver__c = '${employeeId}'`;
    if (status) where += ` AND Status__c = '${status}'`;

    const result = await conn.query(
      `SELECT ${DELIVERY_FIELDS} FROM Delivery__c WHERE ${where} ORDER BY Booking_DateTime__c DESC LIMIT ${limit} OFFSET ${offset}`
    );
    return { records: result.records, total: result.totalSize };
  });
}

/**
 * List deliveries with filters (for operations/dashboard).
 */
async function list({ status, city, driverId, managerId, dateFrom, dateTo, limit = 50, offset = 0 } = {}) {
  return withConnection(async (conn) => {
    const conditions = [];
    if (status) conditions.push(`Status__c = '${status}'`);
    if (city) conditions.push(`Delivery_City__c = '${city}'`);
    if (driverId) conditions.push(`Driver__c = '${driverId}'`);
    if (managerId) conditions.push(`Delivery_Manager__c = '${managerId}'`);
    if (dateFrom) conditions.push(`Booking_DateTime__c >= ${dateFrom}T00:00:00Z`);
    if (dateTo) conditions.push(`Booking_DateTime__c <= ${dateTo}T23:59:59Z`);

    const where = conditions.length > 0 ? conditions.join(' AND ') : '1=1';

    const countResult = await conn.query(`SELECT COUNT() FROM Delivery__c WHERE ${where}`);
    const result = await conn.query(
      `SELECT ${DELIVERY_FIELDS} FROM Delivery__c WHERE ${where} ORDER BY Booking_DateTime__c DESC LIMIT ${limit} OFFSET ${offset}`
    );
    return { records: result.records, total: countResult.totalSize };
  });
}

module.exports = {
  create, findById, update, updateStatus,
  listByAccount, listByDriver, list,
  VALID_STATUSES, STATUS_TRANSITIONS,
};
