/**
 * Unit tests for logging utilities
 */

// Mock winston before any imports
const mockLogger = {
  add: jest.fn(),
  child: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  transports: []
};

const mockTransport = {
  name: 'console'
};

const mockPrintfFunction = jest.fn();

jest.mock('winston', () => ({
  createLogger: jest.fn(() => mockLogger),
  format: {
    combine: jest.fn(() => 'combined-format'),
    timestamp: jest.fn(() => 'timestamp-format'),
    errors: jest.fn(() => 'errors-format'),
    json: jest.fn(() => 'json-format'),
    colorize: jest.fn(() => 'colorize-format'),
    simple: jest.fn(() => 'simple-format'),
    printf: jest.fn((fn) => {
      mockPrintfFunction.mockImplementation(fn);
      return 'printf-format';
    })
  },
  transports: {
    File: jest.fn(() => ({ name: 'file' })),
    Console: jest.fn(() => mockTransport)
  }
}));

const winston = require('winston');

describe('Logger Utilities', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockLogger.add.mockClear();
    mockLogger.child.mockClear();

    // Clear the module cache to ensure fresh imports
    delete require.cache[require.resolve('../../../src/utils/logger')];
    winston.format.combine.mockReturnValue('combined-format');
    winston.format.timestamp.mockReturnValue('timestamp-format');
    winston.format.errors.mockReturnValue('errors-format');
    winston.format.json.mockReturnValue('json-format');
    winston.format.colorize.mockReturnValue('colorize-format');
    winston.format.simple.mockReturnValue('simple-format');
    winston.format.printf.mockReturnValue('printf-format');
  });

  describe('Logger initialization', () => {
    test('should create logger with correct configuration', () => {
      // Ensure LOG_LEVEL is set to info
      const originalLevel = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = 'info';

      winston.createLogger.mockClear();
      delete require.cache[require.resolve('../../../src/utils/logger')];
      require('../../../src/utils/logger');

      expect(winston.createLogger).toHaveBeenCalledWith({
        level: 'info',
        format: 'combined-format',
        defaultMeta: { service: 'minitel-client' },
        transports: [
          expect.any(Object), // File transport for errors
          expect.any(Object)  // File transport for combined logs
        ]
      });

      // Restore
      if (originalLevel !== undefined) {
        process.env.LOG_LEVEL = originalLevel;
      } else {
        delete process.env.LOG_LEVEL;
      }
    });

    test.skip('should use LOG_LEVEL environment variable', () => {
      const originalLevel = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = 'debug';

      // Clear mocks and cache
      winston.createLogger.mockClear();
      delete require.cache[require.resolve('../../../src/utils/logger')];
      require('../../../src/utils/logger');

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug'
        })
      );

      // Restore
      if (originalLevel !== undefined) {
        process.env.LOG_LEVEL = originalLevel;
      } else {
        delete process.env.LOG_LEVEL;
      }
    });

    test.skip('should add console transport in non-production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      // Clear mocks and cache
      mockLogger.add.mockClear();
      delete require.cache[require.resolve('../../../src/utils/logger')];
      require('../../../src/utils/logger');

      expect(mockLogger.add).toHaveBeenCalledWith(expect.any(Object));

      // Restore
      if (originalEnv !== undefined) {
        process.env.NODE_ENV = originalEnv;
      }
    });

    test('should not add console transport in production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Clear and re-require
      delete require.cache[require.resolve('../../../src/utils/logger')];
      require('../../../src/utils/logger');

      expect(mockLogger.add).not.toHaveBeenCalled();

      // Restore
      if (originalEnv !== undefined) {
        process.env.NODE_ENV = originalEnv;
      } else {
        delete process.env.NODE_ENV;
      }
    });
  });

  describe('createChildLogger', () => {
    test('should create child logger with metadata', () => {
      mockLogger.child.mockReturnValue('child-logger');

      const { createChildLogger } = require('../../../src/utils/logger');
      const meta = { component: 'test' };

      const child = createChildLogger(meta);

      expect(mockLogger.child).toHaveBeenCalledWith(meta);
      expect(child).toBe('child-logger');
    });
  });

  describe('createProtocolLogger', () => {
    test('should create protocol logger with correct methods', () => {
      const { createProtocolLogger } = require('../../../src/utils/logger');
      const protocolLogger = createProtocolLogger();

      // Should return the protocolLogger object with expected methods
      expect(protocolLogger).toHaveProperty('logConnection');
      expect(protocolLogger).toHaveProperty('logFrame');
      expect(protocolLogger).toHaveProperty('logProtocolError');
      expect(protocolLogger).toHaveProperty('logRecording');
    });

    test('logConnection should log connection events', () => {
      const { createProtocolLogger } = require('../../../src/utils/logger');
      const protocolLogger = createProtocolLogger();

      const state = { isConnected: true };
      protocolLogger.logConnection('connected', state);

      expect(mockLogger.info).toHaveBeenCalledWith('Connection connected', expect.objectContaining({
        event: 'connected',
        isConnected: true
      }));
    });

    test('logFrame should log frame transmission', () => {
      const { createProtocolLogger } = require('../../../src/utils/logger');
      const protocolLogger = createProtocolLogger();

      const frame = { command: 'HELLO', nonce: 0, payload: 'test', timestamp: '2023-01-01' };
      protocolLogger.logFrame('outbound', frame);

      expect(mockLogger.info).toHaveBeenCalledWith('Frame transmission', expect.objectContaining({
        direction: 'outbound',
        command: 'HELLO',
        nonce: 0,
        payloadSize: expect.any(Number),
        timestamp: '2023-01-01'
      }));
    });

    test('logProtocolError should log protocol errors', () => {
      const { createProtocolLogger } = require('../../../src/utils/logger');
      const protocolLogger = createProtocolLogger();

      const details = { error: 'Test error' };
      protocolLogger.logProtocolError('connection_error', details);

      expect(mockLogger.error).toHaveBeenCalledWith('Protocol error', expect.objectContaining({
        error: 'Test error'
      }));
    });
  });

  describe('Format functions', () => {
    test.skip('winston formats should be configured correctly', () => {
      winston.format.combine.mockClear();
      winston.format.timestamp.mockClear();
      winston.format.printf.mockClear();

      delete require.cache[require.resolve('../../../src/utils/logger')];
      require('../../../src/utils/logger');

      expect(winston.format.combine).toHaveBeenCalled();
      expect(winston.format.timestamp).toHaveBeenCalled();
      expect(winston.format.printf).toHaveBeenCalled();
    });

    test.skip('winston transports should be configured', () => {
      winston.transports.File.mockClear();

      delete require.cache[require.resolve('../../../src/utils/logger')];
      require('../../../src/utils/logger');

      expect(winston.transports.File).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error handling and edge cases', () => {
    test.skip('should handle winston initialization', () => {
      // Clear and test fresh initialization
      winston.createLogger.mockClear();
      delete require.cache[require.resolve('../../../src/utils/logger')];

      const { logger } = require('../../../src/utils/logger');

      expect(winston.createLogger).toHaveBeenCalled();
      expect(logger).toBeDefined();
    });

    test('should handle createChildLogger functionality', () => {
      const { createChildLogger } = require('../../../src/utils/logger');

      expect(typeof createChildLogger).toBe('function');
    });
  });
});
