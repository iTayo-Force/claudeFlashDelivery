const { withConnection } = require('../config/salesforce');

const EMPLOYEE_FIELDS = [
  'Id', 'Name', 'First_Name__c', 'Last_Name__c', 'Salutation__c',
  'Email__c', 'Mobile__c', 'Title__c',
  'IsActive__c', 'IsTest__c', 'Birthday__c',
  'Company__c', 'Customer_Service__c',
  'Current_Location__Latitude__s', 'Current_Location__Longitude__s',
  'Current_Location_DateTime__c',
  'Deactivation_DateTime__c',
].join(', ');

/**
 * Find employee by mobile phone (E164 without +).
 */
async function findByMobile(phone) {
  return withConnection(async (conn) => {
    const result = await conn.query(
      `SELECT ${EMPLOYEE_FIELDS} FROM Employee__c WHERE Mobile__c = '${phone}' AND IsActive__c = true LIMIT 1`
    );
    return result.records[0] || null;
  });
}

/**
 * Find employee by Id.
 */
async function findById(employeeId) {
  return withConnection(async (conn) => {
    const result = await conn.query(
      `SELECT ${EMPLOYEE_FIELDS} FROM Employee__c WHERE Id = '${employeeId}' LIMIT 1`
    );
    return result.records[0] || null;
  });
}

/**
 * List employees with optional filters.
 */
async function list({ role, active, limit = 50, offset = 0 } = {}) {
  return withConnection(async (conn) => {
    const conditions = [];
    if (role) conditions.push(`Title__c = '${role}'`);
    if (active != null) conditions.push(`IsActive__c = ${active}`);

    const where = conditions.length > 0 ? conditions.join(' AND ') : 'IsActive__c = true';

    const countResult = await conn.query(`SELECT COUNT() FROM Employee__c WHERE ${where}`);
    const result = await conn.query(
      `SELECT ${EMPLOYEE_FIELDS} FROM Employee__c WHERE ${where} ORDER BY Name ASC LIMIT ${limit} OFFSET ${offset}`
    );
    return { records: result.records, total: countResult.totalSize };
  });
}

/**
 * List active drivers.
 */
async function listDrivers() {
  return withConnection(async (conn) => {
    const result = await conn.query(
      `SELECT ${EMPLOYEE_FIELDS} FROM Employee__c WHERE Title__c = 'Driver' AND IsActive__c = true ORDER BY Name ASC`
    );
    return result.records;
  });
}

/**
 * Update employee's current GPS location.
 */
async function updateLocation(employeeId, lat, lng) {
  return withConnection(async (conn) => {
    const result = await conn.sobject('Employee__c').update({
      Id: employeeId,
      Current_Location__Latitude__s: lat,
      Current_Location__Longitude__s: lng,
      Current_Location_DateTime__c: new Date().toISOString(),
    });
    if (!result.success) throw new Error(result.errors?.[0]?.message || 'Failed to update location');
    return result;
  });
}

/**
 * Update employee record.
 */
async function update(employeeId, data) {
  return withConnection(async (conn) => {
    const record = { Id: employeeId };
    if (data.firstName) record.First_Name__c = data.firstName;
    if (data.lastName) record.Last_Name__c = data.lastName;
    if (data.email) record.Email__c = data.email;
    if (data.mobile) record.Mobile__c = data.mobile;
    if (data.title) record.Title__c = data.title;
    if (data.isActive != null) record.IsActive__c = data.isActive;
    if (data.customerService != null) record.Customer_Service__c = data.customerService;

    const result = await conn.sobject('Employee__c').update(record);
    if (!result.success) throw new Error(result.errors?.[0]?.message || 'Failed to update employee');
    return result;
  });
}

/**
 * Create a new employee.
 */
async function create(data) {
  return withConnection(async (conn) => {
    const record = {
      First_Name__c: data.firstName,
      Last_Name__c: data.lastName,
      Email__c: data.email,
      Mobile__c: data.mobile,
      Title__c: data.title,
      IsActive__c: true,
    };
    if (data.salutation) record.Salutation__c = data.salutation;
    if (data.birthday) record.Birthday__c = data.birthday;
    if (data.company) record.Company__c = data.company;
    if (data.customerService != null) record.Customer_Service__c = data.customerService;

    const result = await conn.sobject('Employee__c').create(record);
    if (!result.success) throw new Error(result.errors?.[0]?.message || 'Failed to create employee');
    return result.id;
  });
}

module.exports = { findByMobile, findById, list, listDrivers, updateLocation, update, create };
