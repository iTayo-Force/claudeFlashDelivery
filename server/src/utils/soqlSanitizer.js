/**
 * SOQL sanitization utilities to prevent SOQL injection.
 * All user-supplied values MUST pass through these before being used in queries.
 */

/**
 * Validate a Salesforce record ID (15 or 18 alphanumeric characters).
 * Throws if invalid.
 * @param {string} id - The Salesforce ID to validate
 * @param {string} label - Label for error messages (e.g. 'deliveryId')
 * @returns {string} The validated ID
 */
function validateSfId(id, label = 'id') {
  if (!id || typeof id !== 'string') {
    const err = new Error(`${label} is required`);
    err.statusCode = 400;
    throw err;
  }
  if (!/^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test(id)) {
    const err = new Error(`Invalid Salesforce ID for ${label}`);
    err.statusCode = 400;
    throw err;
  }
  return id;
}

/**
 * Escape a string for safe use in SOQL single-quoted literals.
 * Handles: ' → \', \ → \\, and strips null bytes.
 * @param {string} value
 * @returns {string}
 */
function escapeString(value) {
  if (value == null) return '';
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\0/g, '');
}

/**
 * Escape a string for use in SOQL LIKE clauses.
 * Escapes: %, _, ', \, and null bytes.
 * @param {string} value
 * @returns {string}
 */
function escapeLike(value) {
  if (value == null) return '';
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/\0/g, '');
}

/**
 * Validate and return an ISO date string (YYYY-MM-DD).
 * @param {string} value
 * @param {string} label
 * @returns {string}
 */
function validateDate(value, label = 'date') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const err = new Error(`Invalid date format for ${label}. Expected YYYY-MM-DD.`);
    err.statusCode = 400;
    throw err;
  }
  // Verify it's a real date
  const d = new Date(value + 'T00:00:00Z');
  if (isNaN(d.getTime())) {
    const err = new Error(`Invalid date value for ${label}`);
    err.statusCode = 400;
    throw err;
  }
  return value;
}

/**
 * Validate that a value is one of an allowed set (for picklist fields).
 * @param {string} value
 * @param {string[]} allowed
 * @param {string} label
 * @returns {string}
 */
function validateEnum(value, allowed, label = 'value') {
  if (!allowed.includes(value)) {
    const err = new Error(`Invalid ${label}. Allowed: ${allowed.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
  return value;
}

module.exports = { validateSfId, escapeString, escapeLike, validateDate, validateEnum };
