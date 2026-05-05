/**
 * Environment Configuration
 *
 * Centralized configuration management for environment variables.
 * Validates all required environment variables on startup.
 *
 * DESIGN PRINCIPLES:
 * - Fail fast: Invalid configuration crashes the app immediately
 * - Explicit defaults: Only use defaults for non-critical settings
 * - Type safety: Validate and convert environment variables
 */

require('dotenv').config();

/**
 * Validate that a required environment variable is set
 */
function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable not set: ${key}`);
  }
  return value;
}

/**
 * Get environment variable with optional default
 */
function getEnv(key, defaultValue = null) {
  return process.env[key] || defaultValue;
}

/**
 * Get environment variable as boolean
 */
function getBoolEnv(key, defaultValue = false) {
  const value = getEnv(key, String(defaultValue));
  return value === 'true' || value === '1' || value === 'yes';
}

/**
 * Get environment variable as number
 */
function getNumEnv(key, defaultValue = 0) {
  const value = getEnv(key, String(defaultValue));
  const num = parseInt(value, 10);
  if (Number.isNaN(num)) {
    throw new Error(`Environment variable ${key} must be a valid number. Got: ${value}`);
  }
  return num;
}

/**
 * Configuration object
 */
const config = {
  // Environment
  NODE_ENV: getEnv('NODE_ENV', 'development'),
  isDevelopment: getEnv('NODE_ENV', 'development') === 'development',
  isProduction: getEnv('NODE_ENV', 'development') === 'production',
  isTest: getEnv('NODE_ENV', 'development') === 'test',

  // Server
  PORT: getNumEnv('PORT', 3000),
  HOST: getEnv('HOST', 'localhost'),

  // CORS
  CORS_ORIGIN: getEnv('CORS_ORIGIN', '*'),

  // Logging
  LOG_LEVEL: getEnv('LOG_LEVEL', 'info'),
  LOG_DIR: getEnv('LOG_DIR', './logs'),

  // Security
  RATE_LIMIT_WINDOW_MS: getNumEnv('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: getNumEnv('RATE_LIMIT_MAX_REQUESTS', 100),
  MAX_FILE_SIZE_MB: getNumEnv('MAX_FILE_SIZE_MB', 50),
  MAX_BATCH_PARCELS: getNumEnv('MAX_BATCH_PARCELS', 10000),

  // Feature flags
  ENABLE_FILE_UPLOAD: getBoolEnv('ENABLE_FILE_UPLOAD', true),
  ENABLE_BATCH_ROUTE: getBoolEnv('ENABLE_BATCH_ROUTE', true),
  ENABLE_METRICS: getBoolEnv('ENABLE_METRICS', true),

  // Database (for future use)
  DB_HOST: getEnv('DB_HOST'),
  DB_PORT: getNumEnv('DB_PORT', 5432),
  DB_NAME: getEnv('DB_NAME'),
  DB_USER: getEnv('DB_USER'),
  DB_PASSWORD: getEnv('DB_PASSWORD'),

  // API Keys (for future use)
  API_KEY: getEnv('API_KEY'),
  JWT_SECRET: getEnv('JWT_SECRET'),
};

/**
 * Validate critical configuration
 */
function validateConfig() {
  const errors = [];

  if (!config.PORT || config.PORT < 1 || config.PORT > 65535) {
    errors.push('PORT must be between 1 and 65535');
  }

  if (!['development', 'production', 'test'].includes(config.NODE_ENV)) {
    errors.push('NODE_ENV must be "development", "production", or "test"');
  }

  if (config.MAX_FILE_SIZE_MB <= 0) {
    errors.push('MAX_FILE_SIZE_MB must be greater than 0');
  }

  if (config.MAX_BATCH_PARCELS <= 0) {
    errors.push('MAX_BATCH_PARCELS must be greater than 0');
  }

  if (errors.length > 0) {
    console.error('Configuration validation errors:');
    errors.forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
  }
}

// Validate on module load
if (require.main === module || process.env.NODE_ENV !== 'test') {
  validateConfig();
}

module.exports = config;
