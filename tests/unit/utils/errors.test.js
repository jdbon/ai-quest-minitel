/**
 * Tests for Error Handling Utilities
 * Tests error classification, handling, and validation
 */

const {
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
} = require('../../../src/utils/errors');

describe('Error Handling Utilities', () => {
  describe('Error Classes', () => {
    test('MiniTelError should have correct properties', () => {
      const error = new MiniTelError('Test message', 'TEST_CODE', { detail: 'value' });

      expect(error.name).toBe('MiniTelError');
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ detail: 'value' });
      expect(error.timestamp).toBeDefined();
      expect(error instanceof Error).toBe(true);
    });

    test('should serialize to JSON correctly', () => {
      const error = new MiniTelError('Test message', 'TEST_CODE', { key: 'value' });
      const json = error.toJSON();

      expect(json.name).toBe('MiniTelError');
      expect(json.message).toBe('Test message');
      expect(json.code).toBe('TEST_CODE');
      expect(json.details).toEqual({ key: 'value' });
      expect(json.timestamp).toBeDefined();
      expect(json.stack).toBeDefined();
    });

    test('specialized error classes should inherit from MiniTelError', () => {
      const connectionError = new ConnectionError('Connection failed');
      const protocolError = new ProtocolError('Protocol error');
      const authError = new AuthenticationError('Auth failed');
      const configError = new ConfigurationError('Config invalid');
      const recordingError = new RecordingError('Recording failed');
      const replayError = new ReplayError('Replay failed');
      const timeoutError = new TimeoutError('Timeout occurred');

      expect(connectionError instanceof MiniTelError).toBe(true);
      expect(protocolError instanceof MiniTelError).toBe(true);
      expect(authError instanceof MiniTelError).toBe(true);
      expect(configError instanceof MiniTelError).toBe(true);
      expect(recordingError instanceof MiniTelError).toBe(true);
      expect(replayError instanceof MiniTelError).toBe(true);
      expect(timeoutError instanceof MiniTelError).toBe(true);

      expect(connectionError.code).toBe('CONNECTION_ERROR');
      expect(protocolError.code).toBe('PROTOCOL_ERROR');
      expect(authError.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('ErrorHandler', () => {
    let originalConsoleError;
    let mockLogger;

    beforeEach(() => {
      // Mock logger
      mockLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn()
      };

      // Mock the logger module
      jest.mock('../../../src/utils/logger', () => ({
        logger: mockLogger
      }), { virtual: true });

      originalConsoleError = console.error;
      console.error = jest.fn();
    });

    afterEach(() => {
      console.error = originalConsoleError;
      jest.unmock('../../../src/utils/logger');
    });

    test('should handle and log errors appropriately', () => {
      const error = new ProtocolError('Protocol validation failed');
      const context = { command: 'HELLO', nonce: 0 };

      ErrorHandler.handle(error, context, false);

      // Should log error (mocked)
      expect(console.error).toHaveBeenCalled();
    });

    test('should handle fatal errors differently', () => {
      const error = new Error('Fatal system error');

      ErrorHandler.handle(error, {}, true);

      expect(console.error).toHaveBeenCalledWith('[FATAL] Fatal system error');
    });

    test('should classify errors correctly', () => {
      // Connection errors
      const connRefused = new Error('ECONNREFUSED');
      const classified1 = ErrorHandler.classify(connRefused, 'connection');
      expect(classified1 instanceof ConnectionError).toBe(true);

      // Protocol errors
      const protocolErr = new Error('Invalid nonce sequence');
      const classified2 = ErrorHandler.classify(protocolErr, 'protocol');
      expect(classified2 instanceof ProtocolError).toBe(true);

      // Timeout errors
      const timeoutErr = new Error('Connection timeout');
      const classified3 = ErrorHandler.classify(timeoutErr, 'timeout');
      expect(classified3 instanceof ConnectionError).toBe(true); // Timeout classified as connection error

      // Unknown errors
      const unknownErr = new Error('Random error');
      const classified4 = ErrorHandler.classify(unknownErr, 'unknown');
      expect(classified4 instanceof MiniTelError).toBe(true);
      expect(classified4.code).toBe('CLASSIFIED_ERROR');
    });

    test('should wrap async functions with error handling', async() => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Async error'));
      const wrappedFn = ErrorHandler.wrapAsync(mockFn, 'test context');

      await expect(wrappedFn('arg1', 'arg2')).rejects.toThrow();
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    test('should create retry wrapper with correct behavior', async() => {
      let attempts = 0;
      const flakyFunction = jest.fn().mockImplementation(async() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      const retryWrapper = ErrorHandler.withRetry(flakyFunction, 3, 10, 'test operation');

      const result = await retryWrapper();

      expect(result).toBe('success');
      expect(flakyFunction).toHaveBeenCalledTimes(3);
    });

    test('should exhaust retries and throw final error', async() => {
      const alwaysFailingFn = jest.fn().mockRejectedValue(new Error('Always fails'));
      const retryWrapper = ErrorHandler.withRetry(alwaysFailingFn, 2, 1, 'failing operation');

      await expect(retryWrapper()).rejects.toThrow('failing operation failed after 2 attempts');
      expect(alwaysFailingFn).toHaveBeenCalledTimes(2);
    });

    test('should setup global error handlers', () => {
      const originalHandlers = {
        uncaughtException: process.listeners('uncaughtException'),
        unhandledRejection: process.listeners('unhandledRejection'),
        warning: process.listeners('warning')
      };

      // Remove existing handlers
      process.removeAllListeners('uncaughtException');
      process.removeAllListeners('unhandledRejection');
      process.removeAllListeners('warning');

      ErrorHandler.setupGlobalHandlers();

      expect(process.listeners('uncaughtException')).toHaveLength(1);
      expect(process.listeners('unhandledRejection')).toHaveLength(1);
      expect(process.listeners('warning')).toHaveLength(1);

      // Restore original handlers
      process.removeAllListeners('uncaughtException');
      process.removeAllListeners('unhandledRejection');
      process.removeAllListeners('warning');
      originalHandlers.uncaughtException.forEach(handler => process.on('uncaughtException', handler));
      originalHandlers.unhandledRejection.forEach(handler => process.on('unhandledRejection', handler));
      originalHandlers.warning.forEach(handler => process.on('warning', handler));
    });
  });

  describe('ValidationError', () => {
    test('should create validation error with field details', () => {
      const error = new ValidationError('username', null, 'non-empty string');

      expect(error.message).toBe('Invalid username: expected non-empty string, got object');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details.field).toBe('username');
      expect(error.details.value).toBeNull();
      expect(error.details.expected).toBe('non-empty string');
    });
  });

  describe('Validation Utilities', () => {
    describe('validate.string', () => {
      test('should validate valid strings', () => {
        expect(validate.string('hello', 'field')).toBe('hello');
        expect(validate.string('  hello  ', 'field')).toBe('hello'); // Should trim
      });

      test('should reject invalid strings', () => {
        expect(() => validate.string('', 'field')).toThrow(ValidationError);
        expect(() => validate.string('   ', 'field')).toThrow(ValidationError);
        expect(() => validate.string(null, 'field')).toThrow(ValidationError);
        expect(() => validate.string(123, 'field')).toThrow(ValidationError);
      });
    });

    describe('validate.number', () => {
      test('should validate valid numbers', () => {
        expect(validate.number(42, 'field')).toBe(42);
        expect(validate.number(0, 'field')).toBe(0);
        expect(validate.number(-5, 'field')).toBe(-5);
        expect(validate.number(3.14, 'field')).toBe(3.14);
      });

      test('should validate number ranges', () => {
        expect(validate.number(5, 'field', 1, 10)).toBe(5);
        expect(() => validate.number(15, 'field', 1, 10)).toThrow(ValidationError);
        expect(() => validate.number(0, 'field', 1, 10)).toThrow(ValidationError);
      });

      test('should reject invalid numbers', () => {
        expect(() => validate.number('123', 'field')).toThrow(ValidationError);
        expect(() => validate.number(NaN, 'field')).toThrow(ValidationError);
        expect(() => validate.number(null, 'field')).toThrow(ValidationError);
      });
    });

    describe('validate.integer', () => {
      test('should validate valid integers', () => {
        expect(validate.integer(42, 'field')).toBe(42);
        expect(validate.integer(0, 'field')).toBe(0);
        expect(validate.integer(-5, 'field')).toBe(-5);
      });

      test('should reject non-integers', () => {
        expect(() => validate.integer(3.14, 'field')).toThrow(ValidationError);
        expect(() => validate.integer(3.0, 'field')).not.toThrow(); // 3.0 is integer
      });

      test('should validate integer ranges', () => {
        expect(validate.integer(5, 'field', 1, 10)).toBe(5);
        expect(() => validate.integer(15, 'field', 1, 10)).toThrow(ValidationError);
      });
    });

    describe('validate.port', () => {
      test('should validate valid port numbers', () => {
        expect(validate.port(80, 'port')).toBe(80);
        expect(validate.port(8080, 'port')).toBe(8080);
        expect(validate.port(65535, 'port')).toBe(65535);
        expect(validate.port(1, 'port')).toBe(1);
      });

      test('should reject invalid port numbers', () => {
        expect(() => validate.port(0, 'port')).toThrow(ValidationError);
        expect(() => validate.port(65536, 'port')).toThrow(ValidationError);
        expect(() => validate.port(-1, 'port')).toThrow(ValidationError);
        expect(() => validate.port(3.14, 'port')).toThrow(ValidationError);
      });
    });

    describe('validate.timeout', () => {
      test('should validate valid timeout values', () => {
        expect(validate.timeout(100, 'timeout')).toBe(100);
        expect(validate.timeout(5000, 'timeout')).toBe(5000);
        expect(validate.timeout(300000, 'timeout')).toBe(300000); // 5 minutes
      });

      test('should reject invalid timeout values', () => {
        expect(() => validate.timeout(50, 'timeout')).toThrow(ValidationError); // Too small
        expect(() => validate.timeout(300001, 'timeout')).toThrow(ValidationError); // Too large
        expect(() => validate.timeout(-1, 'timeout')).toThrow(ValidationError);
        expect(() => validate.timeout(1.5, 'timeout')).toThrow(ValidationError); // Not integer
      });
    });
  });

  describe('Error Context and Details', () => {
    test('should preserve error context through classification', () => {
      const originalError = new Error('ECONNREFUSED: Connection refused');
      originalError.code = 'ECONNREFUSED';
      originalError.syscall = 'connect';

      const classified = ErrorHandler.classify(originalError, 'connecting to server');

      expect(classified.details.originalError).toBe(originalError);
      expect(classified.details.context).toBe('connecting to server');
    });

    test('should handle nested error details', () => {
      const innerError = new Error('Inner error');
      const outerError = new ProtocolError('Protocol failed', { cause: innerError, step: 'validation' });

      expect(outerError.details.cause).toBe(innerError);
      expect(outerError.details.step).toBe('validation');

      const json = outerError.toJSON();
      expect(json.details.cause).toBe(innerError);
    });
  });

  describe('Edge Cases', () => {
    test('should handle errors with circular references', () => {
      const error = new MiniTelError('Test error');
      error.details.self = error; // Create circular reference

      // Should not throw when converting to JSON
      expect(() => {
        error.toJSON();
      }).not.toThrow();
    });

    test('should handle errors without stack traces', () => {
      const error = new MiniTelError('Test error');
      delete error.stack; // Remove stack trace

      const json = error.toJSON();
      expect(json.stack).toBeUndefined();
    });

    test('should handle validation with edge values', () => {
      // Test boundary values
      expect(validate.port(1)).toBe(1);
      expect(validate.port(65535)).toBe(65535);
      expect(validate.timeout(100)).toBe(100);
      expect(validate.timeout(300000)).toBe(300000);

      // Test floating point precision
      expect(validate.number(0.1 + 0.2, 'field')).toBeCloseTo(0.3);
    });
  });
});
