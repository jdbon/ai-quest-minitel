/**
 * Minimal Integration Tests for MiniTel Application
 * Focus only on testable integration scenarios
 */

const { MockSocket } = require('../mocks/net-mock');

// Mock the net module
jest.mock('net', () => ({
  Socket: MockSocket
}));

const MiniTelApplication = require('../../src/client/application');
const fs = require('fs').promises;
const path = require('path');

describe('MiniTel Application Integration (Minimal)', () => {
  let app;
  let tempRecordingsDir;

  beforeEach(async() => {
    // Create temporary recordings directory
    tempRecordingsDir = path.join(__dirname, '../temp/recordings');
    await fs.mkdir(tempRecordingsDir, { recursive: true });

    // Reset console mocks
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterEach(async() => {
    if (app) {
      try {
        await app.stop();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }

    // Clean up recordings
    try {
      const files = await fs.readdir(tempRecordingsDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(tempRecordingsDir, file)))
      );
    } catch (error) {
      // Directory might not exist
    }
  });

  describe('Application Lifecycle', () => {
    test('should instantiate with correct configuration', () => {
      app = new MiniTelApplication({
        host: 'localhost',
        port: 8080,
        record: false,
        autoReconnect: false
      });

      const status = app.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.config.host).toBe('localhost');
      expect(status.config.port).toBe(8080);
      expect(status.config.recordingEnabled).toBe(false);
    });

    test('should handle connection failure gracefully', async() => {
      jest.spyOn(require('net'), 'Socket').mockImplementation(() => {
        return new MockSocket({
          shouldConnect: false
        });
      });

      app = new MiniTelApplication({
        host: 'localhost',
        port: 8080,
        record: false,
        autoReconnect: false,
        maxReconnectAttempts: 1
      });

      await expect(app.start()).rejects.toThrow('Failed to connect after 1 attempts');
      expect(console.error).toHaveBeenCalledWith('❌ Application failed:', expect.any(String));
    });

    test('should handle graceful shutdown', async() => {
      app = new MiniTelApplication({
        host: 'localhost',
        port: 8080,
        record: false,
        autoReconnect: false
      });

      // App should start as not running
      expect(app.getStatus().isRunning).toBe(false);

      // Stop should work even if not started
      await expect(app.stop()).resolves.toBeUndefined();
    });
  });

  describe('Recording Integration', () => {
    test('should initialize recording when enabled', () => {
      app = new MiniTelApplication({
        host: 'localhost',
        port: 8080,
        record: true,
        recordingsDir: tempRecordingsDir,
        autoReconnect: false
      });

      const status = app.getStatus();
      expect(status.config.recordingEnabled).toBe(true);
      expect(status.recorder).toBeDefined();
    });

    test('should not initialize recording when disabled', () => {
      app = new MiniTelApplication({
        host: 'localhost',
        port: 8080,
        record: false,
        autoReconnect: false
      });

      const status = app.getStatus();
      expect(status.config.recordingEnabled).toBe(false);
      expect(status.recorder).toBeNull();
    });
  });

  describe('Configuration Validation', () => {
    test('should use default configuration values', () => {
      app = new MiniTelApplication({});

      const status = app.getStatus();
      // Application should be properly initialized
      expect(status.isRunning).toBe(false);
      expect(status.client).toBeNull();
      expect(status.reconnectAttempts).toBe(0);
    });

    test('should override defaults with provided config', () => {
      app = new MiniTelApplication({
        host: 'test.example.com',
        port: 9999,
        record: true,
        autoReconnect: true,
        maxReconnectAttempts: 5
      });

      const status = app.getStatus();
      expect(status.config.host).toBe('test.example.com');
      expect(status.config.port).toBe(9999);
      expect(status.config.recordingEnabled).toBe(true);
    });
  });
});
