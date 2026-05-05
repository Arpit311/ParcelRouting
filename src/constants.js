/**
 * Application Constants
 *
 * Centralized constants used throughout the application.
 * Prevents magic numbers and strings scattered in code.
 *
 * DESIGN BENEFIT: Single source of truth for configuration values
 */

const DEPARTMENTS = {
  MAIL: 'Mail',
  REGULAR: 'Regular',
  HEAVY: 'Heavy',
  INSURANCE: 'Insurance',
  DEFAULT: 'Default',
};

const WEIGHT_LIMITS = {
  MAIL_MAX: 1,
  REGULAR_MAX: 10,
  HEAVY_MIN: 10.01,
};

const VALUE_LIMITS = {
  INSURANCE_THRESHOLD: 1000,
  MAX_VALUE: 1000000,
};

const SIZE_LIMITS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_BATCH_PARCELS: 10000,
  MAX_STRING_LENGTH: 1000,
  MAX_RECIPIENT_NAME: 255,
  MAX_COUNTRY_CODE: 100,
};

const RATE_LIMITS = {
  API_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  API_MAX_REQUESTS: 100,
  UPLOAD_WINDOW_MS: 60 * 60 * 1000, // 1 hour
  UPLOAD_MAX_REQUESTS: 20,
};

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
};

const FILE_FORMATS = {
  JSON: 'json',
  XML: 'xml',
};

const OPERATION_STATUS = {
  SUCCESS: 'success',
  FAILURE: 'failure',
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
};

module.exports = {
  DEPARTMENTS,
  WEIGHT_LIMITS,
  VALUE_LIMITS,
  SIZE_LIMITS,
  RATE_LIMITS,
  HTTP_STATUS,
  LOG_LEVELS,
  FILE_FORMATS,
  OPERATION_STATUS,
};
