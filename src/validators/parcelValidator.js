const Joi = require('joi');
const logger = require('../config/logger').child({ origin: 'validation' });

/**
 * Input Validators
 *
 * Validates all user input to prevent invalid data from entering the system.
 *
 * SECURITY PRINCIPLES:
 * - Whitelist approach: Only accept explicitly defined fields
 * - Type validation: Enforce correct data types
 * - Range validation: Ensure values are within acceptable limits
 * - Sanitization: Remove potentially harmful data
 */

// Define validation schemas
const schemas = {
  // Single parcel validation
  singleParcel: Joi.object({
    weight: Joi.number()
      .required()
      .min(0)
      .max(1000)
      .messages({
        'number.base': 'Weight must be a number',
        'number.min': 'Weight must be non-negative',
        'number.max': 'Weight cannot exceed 1000kg',
      }),
    value: Joi.number()
      .required()
      .min(0)
      .max(1000000)
      .messages({
        'number.base': 'Value must be a number',
        'number.min': 'Value must be non-negative',
        'number.max': 'Value cannot exceed €1,000,000',
      }),
    destinationCountry: Joi.string()
      .optional()
      .max(100)
      .trim(),
    recipientName: Joi.string()
      .optional()
      .max(255)
      .trim(),
  }).unknown(false), // Don't allow additional fields

  // Batch parcels validation
  batchParcels: Joi.array()
    .items(
      Joi.object({
        weight: Joi.number()
          .required()
          .min(0)
          .max(1000),
        value: Joi.number()
          .required()
          .min(0)
          .max(1000000),
        destinationCountry: Joi.string()
          .optional()
          .max(100)
          .trim(),
        recipientName: Joi.string()
          .optional()
          .max(255)
          .trim(),
      }).unknown(false)
    )
    .min(1)
    .max(10000)
    .required()
    .messages({
      'array.min': 'Must provide at least 1 parcel',
      'array.max': 'Cannot process more than 10000 parcels at once',
    }),
};

/**
 * Validate a single parcel object
 *
 * @param {Object} parcel - Parcel to validate
 * @returns {Object} Validation result { valid: boolean, error?: string, value?: Object }
 */
function validateSingleParcel(parcel) {
  const { error, value } = schemas.singleParcel.validate(parcel, {
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    logger.warn('Parcel validation failed', {
      error: error.details.map((d) => d.message),
      parcel,
    });
    return {
      valid: false,
      error: error.details[0].message,
    };
  }

  return {
    valid: true,
    value,
  };
}

/**
 * Validate batch of parcels
 *
 * @param {Array} parcels - Array of parcels to validate
 * @returns {Object} Validation result { valid: boolean, error?: string, value?: Array }
 */
function validateBatchParcels(parcels) {
  const { error, value } = schemas.batchParcels.validate(parcels, {
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    logger.warn('Batch validation failed', {
      error: error.details.map((d) => d.message),
      parcelCount: Array.isArray(parcels) ? parcels.length : 'unknown',
    });
    return {
      valid: false,
      error: error.details[0].message,
    };
  }

  return {
    valid: true,
    value,
  };
}

/**
 * Validate file upload parameters
 *
 * @param {string} format - File format (xml or json)
 * @returns {Object} Validation result
 */
function validateFileFormat(format) {
  const fileFormatSchema = Joi.string()
    .valid('xml', 'json')
    .required()
    .messages({
      'any.only': 'Format must be either "xml" or "json"',
    });

  const { error, value } = fileFormatSchema.validate(format);

  if (error) {
    return {
      valid: false,
      error: error.details[0].message,
    };
  }

  return {
    valid: true,
    value,
  };
}

/**
 * Sanitize parcel data
 * Removes potentially harmful content while preserving legitimate data
 *
 * @param {Object} parcel - Parcel to sanitize
 * @returns {Object} Sanitized parcel
 */
function sanitizeParcel(parcel) {
  const sanitized = { ...parcel };

  // Sanitize string fields
  if (sanitized.recipientName && typeof sanitized.recipientName === 'string') {
    sanitized.recipientName = sanitized.recipientName
      .substring(0, 255)
      .replace(/[<>]/g, ''); // Remove angle brackets
  }

  if (sanitized.destinationCountry && typeof sanitized.destinationCountry === 'string') {
    sanitized.destinationCountry = sanitized.destinationCountry
      .substring(0, 100)
      .replace(/[<>]/g, '');
  }

  return sanitized;
}

module.exports = {
  validateSingleParcel,
  validateBatchParcels,
  validateFileFormat,
  sanitizeParcel,
};
