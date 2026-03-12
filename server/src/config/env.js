const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const required = [
  'SF_LOGIN_URL',
  'SF_USERNAME',
  'SF_PASSWORD',
  'SF_SECURITY_TOKEN',
  'JWT_CLIENT_SECRET',
  'JWT_EMPLOYEE_SECRET',
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

module.exports = {
  sf: {
    loginUrl: process.env.SF_LOGIN_URL,
    username: process.env.SF_USERNAME,
    password: process.env.SF_PASSWORD,
    securityToken: process.env.SF_SECURITY_TOKEN,
  },
  jwt: {
    clientSecret: process.env.JWT_CLIENT_SECRET,
    employeeSecret: process.env.JWT_EMPLOYEE_SECRET,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '1h',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  orangeMoney: {
    clientId: process.env.ORANGE_MONEY_CLIENT_ID || '',
    clientSecret: process.env.ORANGE_MONEY_CLIENT_SECRET || '',
    merchantKey: process.env.ORANGE_MONEY_MERCHANT_KEY || '',
  },
  mtnMomo: {
    subscriptionKey: process.env.MTN_MOMO_SUBSCRIPTION_KEY || '',
    apiUser: process.env.MTN_MOMO_API_USER || '',
    apiKey: process.env.MTN_MOMO_API_KEY || '',
    environment: process.env.MTN_MOMO_ENVIRONMENT || 'sandbox',
    callbackUrl: process.env.MTN_MOMO_CALLBACK_URL || '',
  },
  orangeSms: {
    clientId: process.env.ORANGE_SMS_CLIENT_ID || '',
    clientSecret: process.env.ORANGE_SMS_CLIENT_SECRET || '',
  },
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
};
