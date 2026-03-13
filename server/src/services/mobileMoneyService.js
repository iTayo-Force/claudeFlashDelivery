const config = require('../config/env');

// ==================== ORANGE MONEY ====================

let omToken = null;
let omTokenExpiry = 0;

/**
 * Get OAuth2 token for Orange Money API.
 */
async function getOrangeMoneyToken() {
  if (omToken && Date.now() < omTokenExpiry) return omToken;

  const credentials = Buffer.from(
    `${config.orangeMoney.clientId}:${config.orangeMoney.clientSecret}`
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
    throw new Error(`Orange Money auth failed: ${res.status}`);
  }

  const data = await res.json();
  omToken = data.access_token;
  omTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return omToken;
}

/**
 * Initiate an Orange Money payment.
 * @param {object} params
 * @param {string} params.phone - Customer phone (E164 without +, e.g. "237612345678")
 * @param {number} params.amount - Amount in XAF
 * @param {string} params.orderId - Internal order/delivery reference
 * @param {string} params.description - Payment description
 * @returns {object} { paymentUrl, payToken, status }
 */
async function initiateOrangeMoneyPayment({ phone, amount, orderId, description }) {
  if (!config.orangeMoney.clientId) {
    console.warn('[OrangeMoney] Not configured, simulating payment');
    return {
      payToken: `sim_${orderId}_${Date.now()}`,
      paymentUrl: null,
      status: 'simulated',
      notifToken: `notif_${orderId}`,
    };
  }

  const token = await getOrangeMoneyToken();
  const merchantKey = config.orangeMoney.merchantKey;

  const res = await fetch('https://api.orange.com/orange-money-webpay/dev/v1/webpayment', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      merchant_key: merchantKey,
      currency: 'OUV', // Orange Money test currency; use 'XAF' in production
      order_id: orderId,
      amount,
      return_url: config.orangeMoney.returnUrl || 'https://flashdelivery.cm/payment/callback',
      cancel_url: config.orangeMoney.cancelUrl || 'https://flashdelivery.cm/payment/cancel',
      notif_url: config.orangeMoney.notifUrl || 'https://flashdelivery.cm/api/payments/orange-money/webhook',
      lang: 'fr',
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Orange Money payment initiation failed: ${res.status} - ${errBody}`);
  }

  const data = await res.json();
  return {
    payToken: data.pay_token,
    paymentUrl: data.payment_url,
    status: data.status || 'initiated',
    notifToken: data.notif_token,
  };
}

/**
 * Check Orange Money payment status.
 * @param {string} payToken
 * @returns {object} { status, orderId, txnId }
 */
async function checkOrangeMoneyStatus(payToken) {
  if (!config.orangeMoney.clientId) {
    return { status: 'simulated', orderId: 'unknown', txnId: 'sim_txn' };
  }

  const token = await getOrangeMoneyToken();

  const res = await fetch(`https://api.orange.com/orange-money-webpay/dev/v1/transactionstatus`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      order_id: '',
      amount: '',
      pay_token: payToken,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Orange Money status check failed: ${res.status} - ${errBody}`);
  }

  const data = await res.json();
  return {
    status: data.status,
    orderId: data.order_id,
    txnId: data.txnid,
  };
}

// ==================== MTN MOBILE MONEY ====================

let mtnToken = null;
let mtnTokenExpiry = 0;

/**
 * Get API token for MTN MoMo Collections.
 */
async function getMtnToken() {
  if (mtnToken && Date.now() < mtnTokenExpiry) return mtnToken;

  const baseUrl = config.mtnMomo.environment === 'sandbox'
    ? 'https://sandbox.momodeveloper.mtn.com'
    : 'https://momodeveloper.mtn.com';

  const credentials = Buffer.from(
    `${config.mtnMomo.apiUser}:${config.mtnMomo.apiKey}`
  ).toString('base64');

  const res = await fetch(`${baseUrl}/collection/token/`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Ocp-Apim-Subscription-Key': config.mtnMomo.subscriptionKey,
    },
  });

  if (!res.ok) {
    throw new Error(`MTN MoMo auth failed: ${res.status}`);
  }

  const data = await res.json();
  mtnToken = data.access_token;
  mtnTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return mtnToken;
}

/**
 * Generate a UUID v4 for MTN MoMo reference IDs.
 */
function generateUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Request a payment from a customer via MTN MoMo.
 * @param {object} params
 * @param {string} params.phone - Customer phone (E164 without +)
 * @param {number} params.amount - Amount in XAF
 * @param {string} params.orderId - Internal reference
 * @param {string} params.description - Payment note
 * @returns {object} { referenceId, status }
 */
async function initiateMtnPayment({ phone, amount, orderId, description }) {
  if (!config.mtnMomo.subscriptionKey) {
    console.warn('[MtnMoMo] Not configured, simulating payment');
    return {
      referenceId: `sim_mtn_${orderId}_${Date.now()}`,
      status: 'simulated',
    };
  }

  const token = await getMtnToken();
  const referenceId = generateUuid();

  const baseUrl = config.mtnMomo.environment === 'sandbox'
    ? 'https://sandbox.momodeveloper.mtn.com'
    : 'https://momodeveloper.mtn.com';

  const res = await fetch(`${baseUrl}/collection/v1_0/requesttopay`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Reference-Id': referenceId,
      'X-Target-Environment': config.mtnMomo.environment,
      'Ocp-Apim-Subscription-Key': config.mtnMomo.subscriptionKey,
      'X-Callback-Url': config.mtnMomo.callbackUrl || '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: String(amount),
      currency: 'XAF',
      externalId: orderId,
      payer: {
        partyIdType: 'MSISDN',
        partyId: phone,
      },
      payerMessage: description || 'Flash Delivery payment',
      payeeNote: `Order: ${orderId}`,
    }),
  });

  if (!res.ok && res.status !== 202) {
    const errBody = await res.text();
    throw new Error(`MTN MoMo payment request failed: ${res.status} - ${errBody}`);
  }

  return {
    referenceId,
    status: 'pending',
  };
}

/**
 * Check MTN MoMo payment status.
 * @param {string} referenceId - The X-Reference-Id from initiateMtnPayment
 * @returns {object} { status, reason, amount, currency, payer }
 */
async function checkMtnPaymentStatus(referenceId) {
  if (!config.mtnMomo.subscriptionKey) {
    return { status: 'SUCCESSFUL', reason: 'simulated' };
  }

  const token = await getMtnToken();

  const baseUrl = config.mtnMomo.environment === 'sandbox'
    ? 'https://sandbox.momodeveloper.mtn.com'
    : 'https://momodeveloper.mtn.com';

  const res = await fetch(`${baseUrl}/collection/v1_0/requesttopay/${referenceId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Target-Environment': config.mtnMomo.environment,
      'Ocp-Apim-Subscription-Key': config.mtnMomo.subscriptionKey,
    },
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`MTN MoMo status check failed: ${res.status} - ${errBody}`);
  }

  const data = await res.json();
  return {
    status: data.status, // SUCCESSFUL, FAILED, PENDING
    reason: data.reason,
    amount: data.amount,
    currency: data.currency,
    payer: data.payer,
  };
}

module.exports = {
  // Orange Money
  initiateOrangeMoneyPayment,
  checkOrangeMoneyStatus,
  // MTN MoMo
  initiateMtnPayment,
  checkMtnPaymentStatus,
};
