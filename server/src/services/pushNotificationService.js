const { withConnection } = require('../config/salesforce');
const { escapeString } = require('../utils/soqlSanitizer');

/**
 * Register or update a push token for an account.
 */
async function registerToken(accountId, pushToken, platform) {
  const safeToken = escapeString(pushToken);
  const safePlatform = escapeString(platform);

  await withConnection(async (conn) => {
    // Check if token already exists
    const existing = await conn.query(
      `SELECT Id FROM Push_Token__c WHERE Account__c = '${accountId}' AND Token__c = '${safeToken}' LIMIT 1`
    );

    if (existing.records.length > 0) {
      // Update last seen
      await conn.sobject('Push_Token__c').update({
        Id: existing.records[0].Id,
        Last_Used__c: new Date().toISOString(),
        Platform__c: safePlatform,
      });
    } else {
      // Create new token record
      await conn.sobject('Push_Token__c').create({
        Account__c: accountId,
        Token__c: pushToken,
        Platform__c: platform,
        Last_Used__c: new Date().toISOString(),
        Is_Active__c: true,
      });
    }
  });
}

/**
 * Get all active push tokens for an account.
 */
async function getTokensForAccount(accountId) {
  return withConnection(async (conn) => {
    const result = await conn.query(
      `SELECT Token__c, Platform__c FROM Push_Token__c WHERE Account__c = '${accountId}' AND Is_Active__c = true`
    );
    return result.records.map((r) => ({
      token: r.Token__c,
      platform: r.Platform__c,
    }));
  });
}

/**
 * Deactivate a push token (e.g., on logout or invalid token).
 */
async function deactivateToken(pushToken) {
  const safeToken = escapeString(pushToken);
  await withConnection(async (conn) => {
    const existing = await conn.query(
      `SELECT Id FROM Push_Token__c WHERE Token__c = '${safeToken}' LIMIT 1`
    );
    if (existing.records.length > 0) {
      await conn.sobject('Push_Token__c').update({
        Id: existing.records[0].Id,
        Is_Active__c: false,
      });
    }
  });
}

/**
 * Send push notification via Expo Push API.
 * Handles batching (max 100 per request) and error responses.
 *
 * @param {Array<{token: string, platform: string}>} tokens
 * @param {object} notification - { title, body, data }
 */
async function sendPushNotification(tokens, notification) {
  if (!tokens || tokens.length === 0) return [];

  const messages = tokens.map((t) => ({
    to: t.token,
    sound: 'default',
    title: notification.title,
    body: notification.body,
    data: notification.data || {},
    channelId: 'delivery-updates',
  }));

  const results = [];
  // Expo limits to 100 messages per request
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(batch),
      });
      const data = await response.json();
      if (data.data) {
        results.push(...data.data);
        // Handle invalid tokens
        data.data.forEach((ticket, idx) => {
          if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
            deactivateToken(batch[idx].to).catch(() => {});
          }
        });
      }
    } catch (err) {
      console.error('Push notification send failed:', err.message);
    }
  }

  return results;
}

/**
 * Send delivery status notification to the sender.
 */
async function notifyDeliveryStatus(accountId, delivery, newStatus) {
  const tokens = await getTokensForAccount(accountId);
  if (tokens.length === 0) return;

  const statusMessages = {
    Ordered: { title: 'Commande confirmée', body: `Votre livraison ${delivery.ref} est confirmée.` },
    'Picked up': { title: 'Colis ramassé', body: `Votre colis ${delivery.ref} a été ramassé par le chauffeur.` },
    Delivered: { title: 'Livraison effectuée !', body: `Votre colis ${delivery.ref} a été livré avec succès.` },
    Canceled: { title: 'Livraison annulée', body: `Votre livraison ${delivery.ref} a été annulée.` },
  };

  const msg = statusMessages[newStatus] || {
    title: 'Mise à jour livraison',
    body: `Votre livraison ${delivery.ref} a été mise à jour.`,
  };

  await sendPushNotification(tokens, {
    title: msg.title,
    body: msg.body,
    data: { deliveryId: delivery.id, status: newStatus },
  });
}

module.exports = {
  registerToken,
  getTokensForAccount,
  deactivateToken,
  sendPushNotification,
  notifyDeliveryStatus,
};
