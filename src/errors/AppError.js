/**
 * Custom Error Classes
 *
 * Implements a hierarchy of custom errors for different failure scenarios.
 * Allows for specific error handling and logging based on error type.
 *
 * DESIGN PATTERN: Custom exception hierarchy
 * Benefits:
 * - Type-safe error handling
 * - Consistent error responses
 * - Better error tracking and debugging
 * - Proper HTTP status code mapping
 */

/**
 * Base Application Error
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation Error (400)
 * Thrown when input validation fails
 */
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400);
    this.details = details;
  }
}

/**
 * Not Found Error (404)
 * Thrown when a requested resource is not found
 */
class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404);
  }
}

/**
 * Unauthorized Error (401)
 * Thrown when authentication fails
 */
class UnauthorizedError extends AppError {
  constructor(message) {
    super(message, 401);
  }
}

/**
 * Forbidden Error (403)
 * Thrown when user lacks permission
 */
class ForbiddenError extends AppError {
  constructor(message) {
    super(message, 403);
  }
}

/**
 * Conflict Error (409)
 * Thrown when operation conflicts with existing state
 */
class ConflictError extends AppError {
  constructor(message) {
    super(message, 409);
  }
}

/**
 * Internal Server Error (500)
 * Thrown when unexpected server error occurs
 */
class InternalServerError extends AppError {
  constructor(message, originalError = null) {
    super(message, 500);
    this.originalError = originalError;
  }
}

/**
 * Rate Limit Error (429)
 * Thrown when rate limit is exceeded
 */
class RateLimitError extends AppError {
  constructor(message, retryAfter = null) {
    super(message, 429);
    this.retryAfter = retryAfter;
  }
}

/**
 * File Processing Error (422)
 * Thrown when file processing fails
 */
class FileProcessingError extends AppError {
  constructor(message, details = null) {
    super(message, 422);
    this.details = details;
  }
}

/**
 * Service unavailable Error (503)
 * Thrown when a service dependency is unavailable
 */
class ServiceUnavailableError extends AppError {
  constructor(message) {
    super(message, 503);
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  InternalServerError,
  RateLimitError,
  FileProcessingError,
  ServiceUnavailableError,
};
