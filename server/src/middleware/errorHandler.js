/**
 * Centralized error handler middleware.
 * Maps jsforce/Salesforce errors to appropriate HTTP status codes.
 */
function errorHandler(err, req, res, _next) {
  console.error(`[${new Date().toISOString()}] Error:`, err.message);

  // Salesforce-specific errors
  if (err.errorCode === 'INVALID_SESSION_ID') {
    return res.status(503).json({
      error: 'Service temporarily unavailable. Please retry.',
    });
  }

  if (err.errorCode === 'NOT_FOUND' || err.errorCode === 'INVALID_CROSS_REFERENCE_KEY') {
    return res.status(404).json({
      error: 'Record not found.',
    });
  }

  if (err.errorCode === 'FIELD_CUSTOM_VALIDATION_EXCEPTION' ||
      err.errorCode === 'REQUIRED_FIELD_MISSING' ||
      err.errorCode === 'FIELD_INTEGRITY_EXCEPTION') {
    return res.status(400).json({
      error: err.message || 'Validation error.',
    });
  }

  if (err.errorCode === 'DUPLICATE_VALUE' || err.errorCode === 'DUPLICATE_EXTERNAL_ID') {
    return res.status(409).json({
      error: 'A record with this identifier already exists.',
    });
  }

  if (err.errorCode === 'INSUFFICIENT_ACCESS_OR_READONLY') {
    return res.status(403).json({
      error: 'Insufficient permissions.',
    });
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation error',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Authentication failed.',
    });
  }

  // Default
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Internal server error.' : err.message,
  });
}

module.exports = errorHandler;
