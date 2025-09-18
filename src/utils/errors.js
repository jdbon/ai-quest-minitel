/**
 * Comprehensive error handling utilities
 * Provides standardized error types and handling for the MiniTel client
 */

const { logger } = require('./logger');

/**
 * Base application error class
 */
class MiniTelError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for logging/serialization
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * Connection-related errors
 */
class ConnectionError extends MiniTelError {
  constructor(message, details = {}) {
    super(message, 'CONNECTION_ERROR', details);
  }
}

/**
 * Protocol-related errors
 */
class ProtocolError extends MiniTelError {
  constructor(message, details = {}) {
    super(message, 'PROTOCOL_ERROR', details);
  }
}

/**
 * Authentication-related errors
 */
class AuthenticationError extends MiniTelError {
  constructor(message, details = {}) {
    super(message, 'AUTHENTICATION_ERROR', details);
  }
}

/**
 * Configuration-related errors
 */
class ConfigurationError extends MiniTelError {
  constructor(message, details = {}) {
    super(message, 'CONFIGURATION_ERROR', details);
  }
}

/**
 * Recording-related errors
 */
class RecordingError extends MiniTelError {
  constructor(message, details = {}) {
    super(message, 'RECORDING_ERROR', details);
  }
}

/**
 * Replay-related errors
 */
class ReplayError extends MiniTelError {
  constructor(message, details = {}) {
    super(message, 'REPLAY_ERROR', details);
  }
}

/**
 * Timeout-related errors
 */
class TimeoutError extends MiniTelError {
  constructor(message, details = {}) {
    super(message, 'TIMEOUT_ERROR', details);
  }
}

/**
 * Error handler utility class
 */
class ErrorHandler {
  /**
   * Handle and log errors appropriately
   * @param {Error} error - Error to handle
   * @param {Object} context - Additional context
   * @param {boolean} fatal - Whether this is a fatal error
   */
  static handle(error, context = {}, fatal = false) {
    const errorData = {
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR',
      stack: error.stack,
      context,
      fatal
    };

    if (fatal) {
      logger.error('Fatal error occurred', errorData);
    } else if (error instanceof MiniTelError) {
      logger.error(`Application error: ${error.constructor.name}`, errorData);
    } else {
      logger.error('Unexpected error', errorData);
    }

    // In development, also log to console
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[${fatal ? 'FATAL' : 'ERROR'}] ${error.message}`);
      if (context && Object.keys(context).length > 0) {
        console.error('Context:', context);
      }
    }
  }

  /**
   * Create appropriate error instance from generic error
   * @param {Error} error - Generic error
   * @param {string} context - Context where error occurred
   * @returns {MiniTelError} Typed error instance
   */
  static classify(error, context = '') {
    const message = error.message;
    const lowerMessage = message.toLowerCase();

    // Connection-related errors
    if (lowerMessage.includes('connect') ||
        lowerMessage.includes('econnrefused') ||
        lowerMessage.includes('enotfound') ||
        lowerMessage.includes('timeout')) {
      return new ConnectionError(message, { originalError: error, context });
    }

    // Protocol-related errors
    if (lowerMessage.includes('protocol') ||
        lowerMessage.includes('frame') ||
        lowerMessage.includes('nonce') ||
        lowerMessage.includes('hash')) {
      return new ProtocolError(message, { originalError: error, context });
    }

    // Authentication-related errors
    if (lowerMessage.includes('auth') ||
        lowerMessage.includes('hello') ||
        lowerMessage.includes('unauthorized')) {
      return new AuthenticationError(message, { originalError: error, context });
    }

    // Configuration-related errors
    if (lowerMessage.includes('config') ||
        lowerMessage.includes('invalid') ||
        lowerMessage.includes('missing')) {
      return new ConfigurationError(message, { originalError: error, context });
    }

    // Recording-related errors
    if (lowerMessage.includes('record') ||
        lowerMessage.includes('session') ||
        lowerMessage.includes('file')) {
      return new RecordingError(message, { originalError: error, context });
    }

    // Default to generic application error
    return new MiniTelError(message, 'CLASSIFIED_ERROR', { originalError: error, context });
  }

  /**
   * Wrap async functions with error handling
   * @param {Function} fn - Async function to wrap
   * @param {string} context - Context description
   * @returns {Function} Wrapped function
   */
  static wrapAsync(fn, context) {
    return async(...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        const classifiedError = ErrorHandler.classify(error, context);
        ErrorHandler.handle(classifiedError, { args }, false);
        throw classifiedError;
      }
    };
  }

  /**
   * Create a retry wrapper for functions
   * @param {Function} fn - Function to retry
   * @param {number} maxRetries - Maximum retry attempts
   * @param {number} delay - Delay between retries (ms)
   * @param {string} context - Context description
   * @returns {Function} Wrapped function with retry logic
   */
  static withRetry(fn, maxRetries = 3, delay = 1000, context = 'operation') {
    return async(...args) => {
      let lastError;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await fn(...args);
        } catch (error) {
          lastError = error;

          if (attempt === maxRetries) {
            const retryError = new MiniTelError(
              `${context} failed after ${maxRetries} attempts: ${error.message}`,
              'RETRY_EXHAUSTED',
              { attempts: maxRetries, originalError: error }
            );
            ErrorHandler.handle(retryError, { args }, false);
            throw retryError;
          }

          logger.warn(`${context} attempt ${attempt} failed, retrying in ${delay}ms`, {
            attempt,
            maxRetries,
            error: error.message
          });

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      throw lastError;
    };
  }

  /**
   * Setup global error handlers
   */
  static setupGlobalHandlers() {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      ErrorHandler.handle(error, { source: 'uncaughtException' }, true);
      console.error('💥 Uncaught exception, shutting down gracefully...');
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      ErrorHandler.handle(error, {
        source: 'unhandledRejection',
        promise: promise.toString()
      }, true);
      console.error('💥 Unhandled promise rejection, shutting down gracefully...');
      process.exit(1);
    });

    // Handle warnings
    process.on('warning', (warning) => {
      logger.warn('Node.js warning', {
        name: warning.name,
        message: warning.message,
        stack: warning.stack
      });
    });
  }
}

/**
 * Validation utilities
 */
class ValidationError extends MiniTelError {
  constructor(field, value, expected) {
    super(`Invalid ${field}: expected ${expected}, got ${typeof value}`, 'VALIDATION_ERROR', {
      field,
      value,
      expected
    });
  }
}

/**
 * Simple validation helpers
 */
const validate = {
  /**
   * Validate required string
   */
  string(value, fieldName) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new ValidationError(fieldName, value, 'non-empty string');
    }
    return value.trim();
  },

  /**
   * Validate required number
   */
  number(value, fieldName, min = -Infinity, max = Infinity) {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new ValidationError(fieldName, value, 'number');
    }
    if (value < min || value > max) {
      throw new ValidationError(fieldName, value, `number between ${min} and ${max}`);
    }
    return value;
  },

  /**
   * Validate required integer
   */
  integer(value, fieldName, min = -Infinity, max = Infinity) {
    if (!Number.isInteger(value)) {
      throw new ValidationError(fieldName, value, 'integer');
    }
    return validate.number(value, fieldName, min, max);
  },

  /**
   * Validate port number
   */
  port(value, fieldName = 'port') {
    return validate.integer(value, fieldName, 1, 65535);
  },

  /**
   * Validate timeout value
   */
  timeout(value, fieldName = 'timeout') {
    return validate.integer(value, fieldName, 100, 300000); // 100ms to 5 minutes
  }
};

module.exports = {
  MiniTelError,
  ConnectionError,
  ProtocolError,
  AuthenticationError,
  ConfigurationError,
  RecordingError,
  ReplayError,
  TimeoutError,
  ValidationError,
  ErrorHandler,
  validate
};
