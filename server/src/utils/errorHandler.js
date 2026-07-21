/**
 * Centralised Express error handler
 */
const logger = require('./logger');

function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error('Request error', {
    status,
    message,
    path: req.path,
    method: req.method,
  });

  res.status(status).json({
    success: false,
    error: { message, ...(process.env.NODE_ENV === 'development' && { stack: err.stack }) },
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, error: { message: 'Route not found' } });
}

module.exports = { errorHandler, notFoundHandler };
