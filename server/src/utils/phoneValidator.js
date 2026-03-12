const { parsePhoneNumberFromString } = require('libphonenumber-js');

/**
 * Validate and format a phone number to E164 without the leading '+'.
 * Default country: Cameroon (CM).
 * @param {string} phone - The phone number to validate
 * @param {string} defaultCountry - ISO 3166-1 alpha-2 country code (default: 'CM')
 * @returns {{ valid: boolean, formatted: string|null, error: string|null }}
 */
function validateE164(phone, defaultCountry = 'CM') {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, formatted: null, error: 'Phone number is required' };
  }

  const cleaned = phone.replace(/\s+/g, '').trim();
  const parsed = parsePhoneNumberFromString(cleaned, defaultCountry);

  if (!parsed || !parsed.isValid()) {
    return { valid: false, formatted: null, error: 'Invalid phone number' };
  }

  // E164 without leading '+'  (e.g., '237612345678')
  const formatted = parsed.format('E.164').replace(/^\+/, '');

  return { valid: true, formatted, error: null };
}

/**
 * Format a stored phone number (without +) for display.
 * @param {string} phone - Phone number without leading +
 * @returns {string} Display formatted string like "+237 6XX XXX XXX"
 */
function formatForDisplay(phone) {
  if (!phone) return '';
  const withPlus = phone.startsWith('+') ? phone : `+${phone}`;
  const parsed = parsePhoneNumberFromString(withPlus);
  if (!parsed) return phone;
  return parsed.formatInternational();
}

module.exports = { validateE164, formatForDisplay };
