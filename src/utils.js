/**
 * Utility Functions
 *
 * Reusable utility functions for common operations
 */

/**
 * Format a date to ISO string
 *
 * @param {Date} date - Date to format
 * @returns {string} ISO formatted date string
 */
function formatDate(date = new Date()) {
  return date.toISOString();
}

/**
 * Generate a simple ID (not cryptographically secure)
 * For production, use uuid package
 *
 * @returns {string} Simple ID
 */
function generateSimpleId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Safely parse JSON with error handling
 *
 * @param {string} jsonString - JSON string to parse
 * @returns {Object} Parsed object or null
 */
function safeJsonParse(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return null;
  }
}

/**
 * Deep clone an object
 *
 * @param {any} obj - Object to clone
 * @returns {any} Cloned object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if value is within range
 *
 * @param {number} value - Value to check
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {boolean} Whether value is in range
 */
function isInRange(value, min, max) {
  return value >= min && value <= max;
}

/**
 * Create a response object
 *
 * @param {boolean} success - Whether operation was successful
 * @param {any} data - Data to include in response
 * @param {string} message - Optional message
 * @returns {Object} Response object
 */
function createResponse(success, data = null, message = null) {
  const response = { success };

  if (data !== null) {
    response.data = data;
  }

  if (message !== null) {
    response.message = message;
  }

  return response;
}

/**
 * Retry a function with exponential backoff
 *
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delayMs - Initial delay in milliseconds
 * @returns {Promise} Result of function
 */
async function retryWithBackoff(fn, maxRetries = 3, delayMs = 100) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = delayMs * (2 ** attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Measure execution time of a function
 *
 * @param {string} label - Label for the operation
 * @param {Function} fn - Function to measure
 * @returns {any} Result of function
 */
function measureTime(label, fn) {
  const start = Date.now();
  const result = fn();
  const duration = Date.now() - start;
  console.log(`[TIMING] ${label}: ${duration}ms`);
  return result;
}

/**
 * Throttle a function to run at most once every `delay` milliseconds
 *
 * @param {Function} fn - Function to throttle
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(fn, delay) {
  let lastRun = 0;

  return function throttled(...args) {
    const now = Date.now();
    if (now - lastRun >= delay) {
      lastRun = now;
      return fn(...args);
    }
  };
}

/**
 * Debounce a function to run after `delay` milliseconds of inactivity
 *
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(fn, delay) {
  let timeoutId;

  return function debounced(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

module.exports = {
  formatDate,
  generateSimpleId,
  safeJsonParse,
  deepClone,
  isInRange,
  createResponse,
  retryWithBackoff,
  measureTime,
  throttle,
  debounce,
};
