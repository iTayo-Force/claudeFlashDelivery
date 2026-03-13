const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/env');
const errorHandler = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');
const realtimeService = require('./services/realtimeService');

// Import routes
const accountsRouter = require('./routes/accounts');
const deliveriesRouter = require('./routes/deliveries');
const dashboardRouter = require('./routes/dashboard');
const clientPortalRouter = require('./routes/clientPortal');
const employeesRouter = require('./routes/employees');
const operationsRouter = require('./routes/operations');
const routesRouter = require('./routes/routes');
const trackingRouter = require('./routes/tracking');
const paymentsRouter = require('./routes/payments');
const mobileMoneyRouter = require('./routes/mobileMoneyPayments');
const syncRouter = require('./routes/sync');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.nodeEnv === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || []
    : true,
  credentials: true,
}));

// Request logging
if (config.nodeEnv === 'production') {
  morgan.token('sanitized-url', (req) => req.originalUrl.replace(/phone=[^&]+/g, 'phone=***'));
  app.use(morgan(':method :sanitized-url :status :response-time ms'));
} else {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api', generalLimiter);

// API Routes
app.use('/api/accounts', accountsRouter);
app.use('/api/deliveries', deliveriesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/client', clientPortalRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/operations', operationsRouter);
app.use('/api/routes', routesRouter);
app.use('/api/tracking', trackingRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/mobile-money', mobileMoneyRouter);
app.use('/api/sync', syncRouter);

// Health check
app.get('/api/health', (req, res) => {
  const wsStats = realtimeService.getStats();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    websocket: wsStats,
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Create HTTP server and attach WebSocket
const server = http.createServer(app);
realtimeService.init(server);

// Start server
server.listen(config.port, () => {
  console.log(`Flash Delivery API running on port ${config.port} [${config.nodeEnv}]`);
  console.log(`WebSocket available at ws://localhost:${config.port}/ws`);
});

module.exports = app;
