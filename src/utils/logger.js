/**
 * Logging utility for MiniTel Client
 */

const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'minitel-client' },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),

    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ level, message, timestamp, service, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
      })
    )
  }));
}

/**
 * Create a child logger with additional context
 * @param {Object} meta - Additional metadata for all log messages
 * @returns {winston.Logger} Child logger
 */
function createChildLogger(meta) {
  return logger.child(meta);
}

/**
 * Protocol-specific logging helpers
 */
const protocolLogger = {
  /**
   * Log frame transmission
   * @param {string} direction - 'outbound' or 'inbound'
   * @param {Object} frame - Frame details
   */
  logFrame(direction, frame) {
    logger.info('Frame transmission', {
      direction,
      command: frame.command,
      nonce: frame.nonce,
      payloadSize: Buffer.byteLength(frame.payload || '', 'utf8'),
      timestamp: frame.timestamp
    });
  },

  /**
   * Log connection events
   * @param {string} event - Event type
   * @param {Object} details - Event details
   */
  logConnection(event, details = {}) {
    logger.info(`Connection ${event}`, {
      event,
      ...details
    });
  },

  /**
   * Log protocol errors
   * @param {string} error - Error type
   * @param {Object} context - Error context
   */
  logProtocolError(error, context = {}) {
    logger.error('Protocol error', {
      error,
      ...context
    });
  },

  /**
   * Log session recording events
   * @param {string} event - Recording event
   * @param {Object} details - Event details
   */
  logRecording(event, details = {}) {
    logger.info(`Recording ${event}`, {
      event,
      ...details
    });
  }
};

/**
 * Create a protocol logger instance
 * @returns {Object} Protocol logger with specialized methods
 */
function createProtocolLogger() {
  return protocolLogger;
}

module.exports = {
  logger,
  createChildLogger,
  createProtocolLogger,
  protocolLogger
};
