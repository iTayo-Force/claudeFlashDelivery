const config = require('../config/env');

let cachedToken = null;
let tokenExpiry = 0;

/**
 * Get OAuth2 token from Orange SMS API.
 */
async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const credentials = Buffer.from(
    `${config.orangeSms.clientId}:${config.orangeSms.clientSecret}`
  ).toString('base64');

  const res = await fetch('https://api.orange.com/oauth/v3/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    throw new Error(`Orange SMS auth failed: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

/**
 * Send an SMS via Orange SMS API.
 * @param {string} to - Phone number in international format (e.g. "tel:+237612345678")
 * @param {string} message - Message content
 */
async function sendSms(to, message) {
  if (!config.orangeSms.clientId) {
    console.warn('[SMS] Orange SMS not configured, logging message instead');
    console.log(`[SMS] To: ${to} | Message: ${message}`);
    return { status: 'simulated' };
  }

  const token = await getToken();
  const senderAddress = 'tel:+237000000'; // Replace with your registered sender

  const res = await fetch(
    `https://api.orange.com/smsmessaging/v1/outbound/${encodeURIComponent(senderAddress)}/requests`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        outboundSMSMessageRequest: {
          address: to.startsWith('tel:') ? to : `tel:+${to}`,
          senderAddress,
          outboundSMSTextMessage: { message },
        },
      }),
    }
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`SMS send failed: ${res.status} - ${errBody}`);
  }

  return res.json();
}

/**
 * Generate a 6-digit OTP code.
 */
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// In-memory OTP store (use Redis in production)
const otpStore = new Map();

/**
 * Send an OTP code to a phone number.
 */
async function sendOtp(phone) {
  const code = generateOtp();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  otpStore.set(phone, { code, expiresAt, attempts: 0 });

  await sendSms(phone, `Your Flash Delivery verification code is: ${code}. Valid for 5 minutes.`);
  return true;
}

/**
 * Verify an OTP code for a phone number.
 */
function verifyOtp(phone, code) {
  const entry = otpStore.get(phone);
  if (!entry) return { valid: false, error: 'No OTP sent to this number' };

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(phone);
    return { valid: false, error: 'OTP expired' };
  }

  if (entry.attempts >= 3) {
    otpStore.delete(phone);
    return { valid: false, error: 'Too many attempts' };
  }

  entry.attempts++;

  if (entry.code !== code) {
    return { valid: false, error: 'Invalid code' };
  }

  otpStore.delete(phone);
  return { valid: true, error: null };
}

module.exports = { sendSms, sendOtp, verifyOtp, generateOtp };
