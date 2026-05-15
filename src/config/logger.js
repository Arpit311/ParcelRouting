const winston = require('winston');
const path = require('path');
const fs = require('fs');

/**
 * Logger configuration using Winston
 * Provides structured logging with different levels (error, warn, info, debug)
 * Logs are written to both console and files for monitoring and debugging
 */

// On Vercel the project directory is read-only; use /tmp for log files
const logDir = process.env.VERCEL
  ? '/tmp/logs'
  : path.join(process.cwd(), 'logs');

// Ensure log directory exists
try {
  fs.mkdirSync(logDir, { recursive: true });
} catch (_) {
  // Ignore – already exists or not writable; file transport will handle the error
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'warn',
  // We don't set a global format because we want to set it per transport
  transports: [
    // Error log file (human readable text format)
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      ),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      encoding: 'utf8',
    }),
    // Combined log file (human readable text format)
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      ),
      maxsize: 5242880,
      maxFiles: 5,
      encoding: 'utf8',
    }),
  ],
});

// Add console transport in non-production (human readable with colors)
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
      })
    ),
  }));
}

module.exports = logger;
