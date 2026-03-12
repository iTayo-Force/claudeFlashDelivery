const { withConnection } = require('../config/salesforce');

const PAYMENT_FIELDS = [
  'Id', 'Name',
  'Account__c', 'Account__r.Name',
  'Amount__c', 'Total_Paid__c', 'Balance__c',
  'Status__c', 'Type__c',
  'Due_Date__c', 'Label__c',
  'Income_Category__c', 'Expense_Category__c',
  'WhatID__c', 'Related_Object__c',
  'Recurrence__c',
].join(', ');

const LINE_ITEM_FIELDS = [
  'Id', 'Name',
  'Amount__c',
  'Financial_Transaction__c',
].join(', ');

/**
 * Create a Payment record linked to an account and delivery.
 */
async function create(data) {
  return withConnection(async (conn) => {
    const record = {
      Account__c: data.accountId,
      Amount__c: data.amount,
      Status__c: data.status || 'Pending',
      Type__c: data.type || 'Income',
      WhatID__c: data.deliveryId || null,
      Label__c: data.label || '',
      Income_Category__c: data.incomeCategory || 'Delivery',
    };
    if (data.dueDate) record.Due_Date__c = data.dueDate;

    const result = await conn.sobject('Payment__c').create(record);
    if (!result.success) throw new Error(result.errors?.[0]?.message || 'Failed to create payment');
    return result.id;
  });
}

/**
 * Create a Transaction Line Item under a Payment.
 */
async function createLineItem(data) {
  return withConnection(async (conn) => {
    const record = {
      Financial_Transaction__c: data.paymentId,
      Amount__c: data.amount,
    };

    const result = await conn.sobject('Transaction_LineItem__c').create(record);
    if (!result.success) throw new Error(result.errors?.[0]?.message || 'Failed to create line item');
    return result.id;
  });
}

/**
 * Find payment by Id.
 */
async function findById(paymentId) {
  return withConnection(async (conn) => {
    const result = await conn.query(
      `SELECT ${PAYMENT_FIELDS} FROM Payment__c WHERE Id = '${paymentId}' LIMIT 1`
    );
    return result.records[0] || null;
  });
}

/**
 * Update payment status.
 */
async function updateStatus(paymentId, status) {
  return withConnection(async (conn) => {
    const result = await conn.sobject('Payment__c').update({
      Id: paymentId,
      Status__c: status,
    });
    if (!result.success) throw new Error(result.errors?.[0]?.message || 'Failed to update payment');
    return result;
  });
}

/**
 * List payments for an account.
 */
async function listByAccount(accountId, { status, limit = 20, offset = 0 } = {}) {
  return withConnection(async (conn) => {
    let where = `Account__c = '${accountId}'`;
    if (status) where += ` AND Status__c = '${status}'`;

    const countResult = await conn.query(`SELECT COUNT() FROM Payment__c WHERE ${where}`);
    const result = await conn.query(
      `SELECT ${PAYMENT_FIELDS} FROM Payment__c WHERE ${where} ORDER BY CreatedDate DESC LIMIT ${limit} OFFSET ${offset}`
    );
    return { records: result.records, total: countResult.totalSize };
  });
}

/**
 * List payments for a delivery (via WhatID__c).
 */
async function listByDelivery(deliveryId) {
  return withConnection(async (conn) => {
    const result = await conn.query(
      `SELECT ${PAYMENT_FIELDS} FROM Payment__c WHERE WhatID__c = '${deliveryId}' ORDER BY CreatedDate DESC`
    );
    return result.records;
  });
}

/**
 * Get line items for a payment.
 */
async function getLineItems(paymentId) {
  return withConnection(async (conn) => {
    const result = await conn.query(
      `SELECT ${LINE_ITEM_FIELDS} FROM Transaction_LineItem__c WHERE Financial_Transaction__c = '${paymentId}' ORDER BY CreatedDate DESC`
    );
    return result.records;
  });
}

/**
 * List payments with filters (for dashboard/reporting).
 */
async function list({ status, type, dateFrom, dateTo, limit = 50, offset = 0 } = {}) {
  return withConnection(async (conn) => {
    const conditions = [];
    if (status) conditions.push(`Status__c = '${status}'`);
    if (type) conditions.push(`Type__c = '${type}'`);
    if (dateFrom) conditions.push(`CreatedDate >= ${dateFrom}T00:00:00Z`);
    if (dateTo) conditions.push(`CreatedDate <= ${dateTo}T23:59:59Z`);

    const where = conditions.length > 0 ? conditions.join(' AND ') : '1=1';

    const countResult = await conn.query(`SELECT COUNT() FROM Payment__c WHERE ${where}`);
    const result = await conn.query(
      `SELECT ${PAYMENT_FIELDS} FROM Payment__c WHERE ${where} ORDER BY CreatedDate DESC LIMIT ${limit} OFFSET ${offset}`
    );
    return { records: result.records, total: countResult.totalSize };
  });
}

module.exports = { create, createLineItem, findById, updateStatus, listByAccount, listByDelivery, getLineItems, list };
