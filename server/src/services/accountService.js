const { withConnection } = require('../config/salesforce');

const ACCOUNT_FIELDS = [
  'Id', 'FirstName', 'LastName', 'PersonEmail', 'Phone', 'PersonMobilePhone',
  'PhoneID__c', 'Language__c', 'Company_OR_PrivateIndividual__c',
  'Main_Pickup_Location__c', 'Main_Pickup_GeoLocation__Latitude__s', 'Main_Pickup_GeoLocation__Longitude__s',
  'Main_Delivery_Location__c', 'Main_Delivery_GeoLocation__Latitude__s', 'Main_Delivery_GeoLocation__Longitude__s',
  'Delivery_Scoring__c', 'Pickup_Scoring__c',
  'Delivery_Revenue__c', 'Last_Sent_Delivery__c',
  'Flash_Delivery_Follow_up_Date__c', 'Account_Manager__c',
].join(', ');

/**
 * Find a PersonAccount by phone (PhoneID__c stores E164 without +).
 */
async function findByPhone(phone) {
  return withConnection(async (conn) => {
    const result = await conn.query(
      `SELECT ${ACCOUNT_FIELDS} FROM Account WHERE PhoneID__c = '${phone}' AND IsPersonAccount = true LIMIT 1`
    );
    return result.records[0] || null;
  });
}

/**
 * Find a PersonAccount by Id.
 */
async function findById(accountId) {
  return withConnection(async (conn) => {
    const result = await conn.query(
      `SELECT ${ACCOUNT_FIELDS} FROM Account WHERE Id = '${accountId}' AND IsPersonAccount = true LIMIT 1`
    );
    return result.records[0] || null;
  });
}

/**
 * Create a new PersonAccount.
 */
async function create(data) {
  return withConnection(async (conn) => {
    // PersonAccounts use the Account object with a specific RecordType
    const rtResult = await conn.query(
      "SELECT Id FROM RecordType WHERE SObjectType = 'Account' AND IsPersonType = true LIMIT 1"
    );
    const recordTypeId = rtResult.records[0]?.Id;
    if (!recordTypeId) throw new Error('PersonAccount RecordType not found');

    const record = {
      RecordTypeId: recordTypeId,
      FirstName: data.firstName,
      LastName: data.lastName,
      PersonMobilePhone: data.phone,
      PhoneID__c: data.phoneId,
      Language__c: data.language || 'French',
      Company_OR_PrivateIndividual__c: data.type || 'PrivateIndividual',
    };

    if (data.email) record.PersonEmail = data.email;
    if (data.mainPickupLocation) record.Main_Pickup_Location__c = data.mainPickupLocation;
    if (data.mainPickupLat != null && data.mainPickupLng != null) {
      record.Main_Pickup_GeoLocation__Latitude__s = data.mainPickupLat;
      record.Main_Pickup_GeoLocation__Longitude__s = data.mainPickupLng;
    }
    if (data.mainDeliveryLocation) record.Main_Delivery_Location__c = data.mainDeliveryLocation;
    if (data.mainDeliveryLat != null && data.mainDeliveryLng != null) {
      record.Main_Delivery_GeoLocation__Latitude__s = data.mainDeliveryLat;
      record.Main_Delivery_GeoLocation__Longitude__s = data.mainDeliveryLng;
    }

    const result = await conn.sobject('Account').create(record);
    if (!result.success) throw new Error(result.errors?.[0]?.message || 'Failed to create account');
    return result.id;
  });
}

/**
 * Update a PersonAccount.
 */
async function update(accountId, data) {
  return withConnection(async (conn) => {
    const record = { Id: accountId };
    if (data.firstName) record.FirstName = data.firstName;
    if (data.lastName) record.LastName = data.lastName;
    if (data.email) record.PersonEmail = data.email;
    if (data.language) record.Language__c = data.language;
    if (data.mainPickupLocation) record.Main_Pickup_Location__c = data.mainPickupLocation;
    if (data.mainPickupLat != null && data.mainPickupLng != null) {
      record.Main_Pickup_GeoLocation__Latitude__s = data.mainPickupLat;
      record.Main_Pickup_GeoLocation__Longitude__s = data.mainPickupLng;
    }
    if (data.mainDeliveryLocation) record.Main_Delivery_Location__c = data.mainDeliveryLocation;
    if (data.mainDeliveryLat != null && data.mainDeliveryLng != null) {
      record.Main_Delivery_GeoLocation__Latitude__s = data.mainDeliveryLat;
      record.Main_Delivery_GeoLocation__Longitude__s = data.mainDeliveryLng;
    }
    if (data.accountManager) record.Account_Manager__c = data.accountManager;
    if (data.followUpDate) record.Flash_Delivery_Follow_up_Date__c = data.followUpDate;

    const result = await conn.sobject('Account').update(record);
    if (!result.success) throw new Error(result.errors?.[0]?.message || 'Failed to update account');
    return result;
  });
}

/**
 * Search accounts by name or phone.
 */
async function search(query, limit = 20) {
  return withConnection(async (conn) => {
    const escapedQuery = query.replace(/'/g, "\\'");
    const result = await conn.query(
      `SELECT ${ACCOUNT_FIELDS} FROM Account
       WHERE IsPersonAccount = true
       AND (Name LIKE '%${escapedQuery}%' OR PhoneID__c LIKE '%${escapedQuery}%' OR Phone LIKE '%${escapedQuery}%')
       ORDER BY LastModifiedDate DESC
       LIMIT ${limit}`
    );
    return result.records;
  });
}

/**
 * List accounts with pagination.
 */
async function list({ limit = 20, offset = 0, scoring } = {}) {
  return withConnection(async (conn) => {
    let where = 'IsPersonAccount = true';
    if (scoring) where += ` AND Delivery_Scoring__c = '${scoring}'`;

    const countResult = await conn.query(`SELECT COUNT() FROM Account WHERE ${where}`);
    const total = countResult.totalSize;

    const result = await conn.query(
      `SELECT ${ACCOUNT_FIELDS} FROM Account WHERE ${where} ORDER BY LastModifiedDate DESC LIMIT ${limit} OFFSET ${offset}`
    );
    return { records: result.records, total };
  });
}

module.exports = { findByPhone, findById, create, update, search, list };
