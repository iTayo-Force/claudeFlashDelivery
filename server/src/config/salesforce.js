const jsforce = require('jsforce');
const config = require('./env');

let conn = null;
let isConnecting = false;

async function getConnection() {
  if (conn && conn.accessToken) {
    return conn;
  }

  if (isConnecting) {
    // Wait for in-progress connection
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (!isConnecting) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
    return conn;
  }

  isConnecting = true;
  try {
    conn = new jsforce.Connection({ loginUrl: config.sf.loginUrl });
    await conn.login(
      config.sf.username,
      config.sf.password + config.sf.securityToken
    );
    console.log('Salesforce connected. User ID:', conn.userInfo.id);

    // Handle token refresh / expiry
    conn.on('error', (err) => {
      if (err.errorCode === 'INVALID_SESSION_ID') {
        console.warn('Salesforce session expired, will reconnect on next request');
        conn = null;
      }
    });

    return conn;
  } catch (err) {
    conn = null;
    throw new Error(`Salesforce login failed: ${err.message}`);
  } finally {
    isConnecting = false;
  }
}

/**
 * Execute a Salesforce operation with auto-retry on session expiry.
 */
async function withConnection(operation) {
  try {
    const connection = await getConnection();
    return await operation(connection);
  } catch (err) {
    if (err.errorCode === 'INVALID_SESSION_ID' || err.name === 'INVALID_SESSION_ID') {
      console.warn('Session expired, reconnecting...');
      conn = null;
      const connection = await getConnection();
      return await operation(connection);
    }
    throw err;
  }
}

module.exports = { getConnection, withConnection };
