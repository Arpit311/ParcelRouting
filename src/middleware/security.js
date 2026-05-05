const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const logger = require('../config/logger').child({ origin: 'middleware' });

/**
 * Security Middleware
 *
 * Implements layered security measures to protect the application.
 *
 * SECURITY MEASURES:
 * - Rate limiting: Prevent brute force and DoS attacks
 * - Helmet: Set security HTTP headers
 * - CORS: Control cross-origin requests
 * - Input validation: Reject malformed requests
 * - Error handling: Don't expose internal details
 */

/**
 * Rate limiter for general API endpoints
 * Prevents abuse and DoS attacks
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  skip: (req) => process.env.NODE_ENV === 'test', // Don't apply in tests
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later.',
    });
  },
});

/**
 * Stricter rate limiter for file upload endpoints
 * Prevents large file upload attacks
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 uploads per hour
  message: 'Too many upload requests, please try again later.',
  skip: (req) => process.env.NODE_ENV === 'test',
});

/**
 * Helmet middleware configuration
 * Sets security-related HTTP headers
 */
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
});

/**
 * Error handler middleware
 * Catches unhandled errors and returns safe responses
 */
function errorHandler(err, req, res, next) {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  let statusCode = err.statusCode || 500;
  let clientMessage = err.message;

  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    clientMessage = 'File size exceeds maximum upload limit';
  }

  if (statusCode === 500) {
    clientMessage = 'An internal server error occurred';
  }

  res.status(statusCode).json({
    success: false,
    error: clientMessage,
  });
}

/**
 * Request logging middleware
 * Logs all incoming requests for monitoring
 */
function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });

  next();
}

/**
 * Input sanitization middleware
 * Cleans request data
 */
function inputSanitizer(req, res, next) {
  // Sanitize query parameters
  Object.keys(req.query).forEach((key) => {
    if (typeof req.query[key] === 'string') {
      req.query[key] = req.query[key].trim().substring(0, 1000);
    }
  });

  next();
}

module.exports = {
  apiLimiter,
  uploadLimiter,
  helmetMiddleware,
  errorHandler,
  requestLogger,
  inputSanitizer,
};
