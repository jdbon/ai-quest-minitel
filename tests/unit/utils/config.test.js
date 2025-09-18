/**
 * Unit tests for configuration utilities
 */

const { parseArguments, validateConfig, displayConfig, getDefaultConfig } = require('../../../src/utils/config');

describe('Configuration Utilities', () => {
  // Save original process.argv
  let originalArgv;
  let originalEnv;

  beforeEach(() => {
    originalArgv = process.argv;
    originalEnv = { ...process.env };

    // Reset environment variables
    delete process.env.SERVER_HOST;
    delete process.env.SERVER_PORT;
    delete process.env.LOG_LEVEL;
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
  });

  describe('getDefaultConfig', () => {
    test('should return default configuration', () => {
      const config = getDefaultConfig();

      expect(config).toEqual({
        host: 'localhost',
        port: 8080,
        timeout: 2000,
        record: false,
        recordingsDir: expect.stringContaining('recordings'),
        logLevel: 'info',
        autoReconnect: true,
        maxReconnectAttempts: 3,
        reconnectDelay: 1000,
        interactive: false
      });
    });

    test('should use environment variables when available', () => {
      process.env.SERVER_HOST = 'test.example.com';
      process.env.SERVER_PORT = '8080';
      process.env.LOG_LEVEL = 'debug';

      const config = getDefaultConfig();

      expect(config.host).toBe('test.example.com');
      expect(config.port).toBe(8080);
      expect(config.logLevel).toBe('debug');
    });

    test('should handle invalid environment port gracefully', () => {
      process.env.SERVER_PORT = 'invalid';

      const config = getDefaultConfig();
      expect(config.port).toBe(8080); // Should fallback to new default
    });
  });

  describe('parseArguments', () => {
    test('should return configuration object with defaults', () => {
      // parseArguments uses yargs which parses process.argv
      // Instead of mocking the complex yargs behavior, test that it returns a config object
      const args = parseArguments();

      expect(args).toHaveProperty('host');
      expect(args).toHaveProperty('port');
      expect(args).toHaveProperty('record');
      expect(args).toHaveProperty('interactive');
      expect(typeof args.host).toBe('string');
      expect(typeof args.port).toBe('number');
      expect(typeof args.record).toBe('boolean');
      expect(typeof args.interactive).toBe('boolean');
    });

    test('should include all expected configuration properties', () => {
      const args = parseArguments();

      expect(args).toHaveProperty('host');
      expect(args).toHaveProperty('port');
      expect(args).toHaveProperty('timeout');
      expect(args).toHaveProperty('record');
      expect(args).toHaveProperty('recordingsDir');
      expect(args).toHaveProperty('logLevel');
      expect(args).toHaveProperty('autoReconnect');
      expect(args).toHaveProperty('maxReconnectAttempts');
      expect(args).toHaveProperty('reconnectDelay');
      expect(args).toHaveProperty('interactive');
    });
  });

  describe('validateConfig', () => {
    test('should validate valid configuration', () => {
      const input = {
        host: 'localhost',
        port: 8080,
        timeout: 5000,
        record: true,
        interactive: false
      };

      const config = validateConfig(input);

      expect(config.host).toBe('localhost');
      expect(config.port).toBe(8080);
      expect(config.timeout).toBe(5000);
      expect(config.record).toBe(true);
      expect(config.interactive).toBe(false);
    });

    test('should throw error for invalid host', () => {
      const baseConfig = getDefaultConfig();
      const input = { ...baseConfig, host: '' };

      expect(() => validateConfig(input)).toThrow('Invalid host');
    });

    test('should throw error for invalid port', () => {
      const baseConfig = getDefaultConfig();
      const input = { ...baseConfig, port: 0 };

      expect(() => validateConfig(input)).toThrow('Invalid port');

      const input2 = { ...baseConfig, port: 70000 };
      expect(() => validateConfig(input2)).toThrow('Invalid port');
    });

    test('should throw error for invalid timeout', () => {
      const baseConfig = getDefaultConfig();
      const input = { ...baseConfig, timeout: -1 };

      expect(() => validateConfig(input)).toThrow('Invalid timeout');
    });

    test('should throw error for invalid log level', () => {
      const baseConfig = getDefaultConfig();
      const input = { ...baseConfig, logLevel: 'invalid' };

      expect(() => validateConfig(input)).toThrow('Invalid log level');
    });

    test('should throw error for invalid reconnect attempts', () => {
      const baseConfig = getDefaultConfig();
      const input = { ...baseConfig, maxReconnectAttempts: -1 };

      expect(() => validateConfig(input)).toThrow('Invalid max reconnect attempts');
    });

    test('should throw error for invalid reconnect delay', () => {
      const baseConfig = getDefaultConfig();
      const input = { ...baseConfig, reconnectDelay: -1 };

      expect(() => validateConfig(input)).toThrow('Invalid reconnect delay');
    });

    test('should normalize string boolean values', () => {
      const baseConfig = getDefaultConfig();
      const input = {
        ...baseConfig,
        record: 'true',
        interactive: 'false',
        autoReconnect: '1'
      };

      const config = validateConfig(input);

      expect(config.record).toBe(true);
      expect(config.interactive).toBe(false);
      expect(config.autoReconnect).toBe(true);
    });

    test('should handle edge cases in port validation', () => {
      const baseConfig = getDefaultConfig();
      const validPorts = [1, 1024, 8080, 65535];
      const invalidPorts = [0, -1, 65536, 'abc', null];

      validPorts.forEach(port => {
        expect(() => validateConfig({ ...baseConfig, port })).not.toThrow();
      });

      invalidPorts.forEach(port => {
        expect(() => validateConfig({ ...baseConfig, port })).toThrow();
      });
    });
  });

  describe('displayConfig', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    test('should display configuration summary', () => {
      const config = {
        host: 'localhost',
        port: 8080,
        timeout: 2000,
        record: true,
        recordingsDir: './recordings',
        logLevel: 'debug',
        autoReconnect: false
      };

      displayConfig(config);

      expect(consoleSpy).toHaveBeenCalledWith('\n📋 Configuration Summary:');
      expect(consoleSpy).toHaveBeenCalledWith('   Server: localhost:8080');
      expect(consoleSpy).toHaveBeenCalledWith('   Timeout: 2000ms');
      expect(consoleSpy).toHaveBeenCalledWith('   Recording: ✅ Enabled');
      expect(consoleSpy).toHaveBeenCalledWith('   Recordings Directory: ./recordings');
      expect(consoleSpy).toHaveBeenCalledWith('   Log Level: debug');
      expect(consoleSpy).toHaveBeenCalledWith('   Auto Reconnect: ❌ Disabled');
    });

    test('should display disabled recording', () => {
      const config = {
        host: 'localhost',
        port: 8080,
        record: false
      };

      displayConfig(config);

      expect(consoleSpy).toHaveBeenCalledWith('   Recording: ❌ Disabled');
    });

    test('should handle missing optional fields', () => {
      const config = {
        host: 'localhost',
        port: 8080
      };

      expect(() => displayConfig(config)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('\n📋 Configuration Summary:');
    });
  });

  describe('Integration scenarios', () => {
    test('should integrate parseArguments and validateConfig', () => {
      // Test that parseArguments output can be validated
      const args = parseArguments();

      expect(() => validateConfig(args)).not.toThrow();
      const config = validateConfig(args);

      expect(config).toHaveProperty('host');
      expect(config).toHaveProperty('port');
      expect(config).toHaveProperty('record');
      expect(typeof config.host).toBe('string');
      expect(typeof config.port).toBe('number');
    });

    test('should handle configuration display', () => {
      const args = parseArguments();
      const config = validateConfig(args);

      expect(() => displayConfig(config)).not.toThrow();
      // Note: console output is captured in previous tests with consoleSpy
    });
  });
});
