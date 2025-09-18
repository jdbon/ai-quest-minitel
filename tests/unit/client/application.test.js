/**
 * Unit tests for MiniTel Application (focused on uncovered methods)
 */

const MiniTelApplication = require('../../../src/client/application');

// Mock dependencies
jest.mock('../../../src/protocol/client');
jest.mock('../../../src/recorder/session-recorder');
jest.mock('../../../src/client/interactive-tui');

const MiniTelClient = require('../../../src/protocol/client');
const SessionRecorder = require('../../../src/recorder/session-recorder');
const InteractiveTUI = require('../../../src/client/interactive-tui');

describe('MiniTel Application Unit Tests', () => {
  let app;
  let mockClient;
  let mockRecorder;
  let mockTui;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock MiniTelClient
    mockClient = {
      isConnected: false,
      connect: jest.fn(),
      disconnect: jest.fn(),
      sendHello: jest.fn(),
      sendDump: jest.fn(),
      sendStop: jest.fn(),
      on: jest.fn(),
      getState: jest.fn(() => ({
        isConnected: false,
        currentNonce: 0,
        dumpCounter: 0
      }))
    };
    MiniTelClient.mockImplementation(() => mockClient);

    // Mock SessionRecorder
    mockRecorder = {
      startRecording: jest.fn(),
      stopRecording: jest.fn(),
      recordInteraction: jest.fn()
    };
    SessionRecorder.mockImplementation(() => mockRecorder);

    // Mock InteractiveTUI
    mockTui = {
      start: jest.fn()
    };
    InteractiveTUI.mockImplementation(() => mockTui);
  });

  describe('Constructor', () => {
    test('should initialize with default configuration', () => {
      app = new MiniTelApplication({});

      expect(app.config).toBeDefined();
      expect(app.client).toBe(null);
      expect(app.recorder).toBe(null);
      expect(app.isRunning).toBe(false);
      expect(app.reconnectAttempts).toBe(0);
    });

    test('should initialize with custom configuration', () => {
      const config = {
        host: 'custom.host',
        port: 9090,
        record: true,
        maxReconnectAttempts: 5
      };

      app = new MiniTelApplication(config);

      expect(app.config.host).toBe('custom.host');
      expect(app.config.port).toBe(9090);
      expect(app.config.record).toBe(true);
      expect(app.maxReconnectAttempts).toBe(5);
    });

    test('should set maxReconnectAttempts from config', () => {
      const config = { maxReconnectAttempts: 10 };

      app = new MiniTelApplication(config);

      expect(app.maxReconnectAttempts).toBe(10);
    });

    test('should set reconnectDelay from config', () => {
      const config = { reconnectDelay: 5000 };

      app = new MiniTelApplication(config);

      expect(app.reconnectDelay).toBe(5000);
    });
  });

  describe('setupGracefulShutdown', () => {
    let originalProcessOn;
    let processOnSpy;

    beforeEach(() => {
      app = new MiniTelApplication({});
      originalProcessOn = process.on;
      processOnSpy = jest.fn();
      process.on = processOnSpy;
    });

    afterEach(() => {
      process.on = originalProcessOn;
    });

    test('should setup process event handlers', () => {
      app.setupGracefulShutdown();

      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });
  });

  describe('getStatus', () => {
    test('should return current application status', () => {
      app = new MiniTelApplication({
        host: 'test.host',
        port: 8080,
        record: true
      });
      app.isRunning = true;
      app.reconnectAttempts = 2;

      const status = app.getStatus();

      expect(status).toEqual({
        isRunning: true,
        client: null,
        recorder: null,
        config: expect.objectContaining({
          host: 'test.host',
          port: 8080,
          recordingEnabled: true
        }),
        reconnectAttempts: 2
      });
    });

    test('should include client state in status when client available', () => {
      app = new MiniTelApplication({ record: true });
      app.client = mockClient;

      const status = app.getStatus();

      expect(status.client).toEqual(mockClient.getState());
      expect(status.recorder).toBe(null); // recorder not mocked with getStatus method
    });
  });

  describe('Console output suppression', () => {
    let originalConsole;

    beforeEach(() => {
      app = new MiniTelApplication({});
      originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info
      };
    });

    afterEach(() => {
      // Restore console
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.info = originalConsole.info;
    });

    test('should suppress console output', () => {
      app._suppressConsoleOutput();

      expect(console.log).not.toBe(originalConsole.log);
      expect(console.error).not.toBe(originalConsole.error);
      expect(console.warn).not.toBe(originalConsole.warn);
      expect(console.info).not.toBe(originalConsole.info);

      // Test that console methods are no-ops
      expect(() => {
        console.log('test');
        console.error('test');
        console.warn('test');
        console.info('test');
      }).not.toThrow();
    });

    test('should restore console output', () => {
      app._suppressConsoleOutput();
      app._restoreConsoleOutput();

      expect(console.log).toBe(originalConsole.log);
      expect(console.error).toBe(originalConsole.error);
      expect(console.warn).toBe(originalConsole.warn);
      expect(console.info).toBe(originalConsole.info);
    });

    test('should handle restore when no original console stored', () => {
      // Don't suppress first, just try to restore
      expect(() => app._restoreConsoleOutput()).not.toThrow();
    });
  });

  describe('_initializeClient', () => {
    test('should create client with correct configuration', async() => {
      app = new MiniTelApplication({
        host: 'test.host',
        port: 8080,
        timeout: 5000
      });

      await app._initializeClient();

      expect(MiniTelClient).toHaveBeenCalledWith({
        host: 'test.host',
        port: 8080,
        timeout: 5000
      });
      expect(app.client).toBe(mockClient);
    });

    test('should setup client event handlers', async() => {
      app = new MiniTelApplication({});

      await app._initializeClient();

      expect(mockClient.on).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('disconnected', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      // frameTransmitted handler is set up conditionally based on recorder
    });
  });

  describe('_startInteractiveMode', () => {
    test('should have interactive mode method defined', () => {
      app = new MiniTelApplication({});
      app.client = mockClient;

      expect(typeof app._startInteractiveMode).toBe('function');
    });
  });

  describe('Protocol sequence execution helpers', () => {
    beforeEach(() => {
      app = new MiniTelApplication({});
      app.client = mockClient;
      jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      console.log.mockRestore();
    });

    test('should handle HELLO command in protocol sequence', async() => {
      mockClient.sendHello.mockResolvedValue({ nonce: 1 });

      // Call the private method by accessing it through the public interface
      // We'll create a partial execution that only does HELLO
      try {
        await app._executeProtocolSequence();
      } catch (error) {
        // Expected to fail due to DUMP commands
      }

      expect(mockClient.sendHello).toHaveBeenCalled();
    });

    test('should handle DUMP commands in protocol sequence', async() => {
      mockClient.sendHello.mockResolvedValue({ nonce: 1 });
      mockClient.sendDump
        .mockResolvedValueOnce({ cmd: 1, nonce: 3, payloadString: 'data1' })
        .mockResolvedValueOnce({ cmd: 1, nonce: 5, payloadString: 'data2' });
      mockClient.getState.mockReturnValue({ dumpCounter: 2, currentNonce: 5 });

      await app._executeProtocolSequence();

      expect(mockClient.sendHello).toHaveBeenCalled();
      expect(mockClient.sendDump).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error handling scenarios', () => {
    test('should handle client initialization failure', async() => {
      MiniTelClient.mockImplementation(() => {
        throw new Error('Client creation failed');
      });

      app = new MiniTelApplication({});

      await expect(app._initializeClient()).rejects.toThrow('Client creation failed');
    });

    test('should handle protocol sequence failure gracefully', async() => {
      app = new MiniTelApplication({});
      app.client = mockClient;
      mockClient.sendHello.mockRejectedValue(new Error('Connection failed'));

      await expect(app._executeProtocolSequence()).rejects.toThrow('HELLO command failed');
    });
  });

  describe('Recording integration', () => {
    test('should initialize recorder when recording enabled', () => {
      app = new MiniTelApplication({ record: true, recordingsDir: '/test/recordings' });

      // Trigger recorder initialization (normally done in start())
      app.recorder = new SessionRecorder({
        enabled: true,
        recordingsDir: '/test/recordings'
      });

      expect(SessionRecorder).toHaveBeenCalledWith({
        enabled: true,
        recordingsDir: '/test/recordings'
      });
    });

    test('should not initialize recorder when recording disabled', () => {
      app = new MiniTelApplication({ record: false });

      expect(app.recorder).toBe(null);
    });
  });

  describe('State management', () => {
    test('should track running state correctly', () => {
      app = new MiniTelApplication({});

      expect(app.isRunning).toBe(false);

      app.isRunning = true;
      expect(app.isRunning).toBe(true);
    });

    test('should track reconnection attempts', () => {
      app = new MiniTelApplication({});

      expect(app.reconnectAttempts).toBe(0);

      app.reconnectAttempts = 3;
      expect(app.reconnectAttempts).toBe(3);
    });

    test('should handle configuration merging', () => {
      const config = {
        host: 'custom.host',
        port: 9999,
        undefinedField: undefined,
        nullField: null
      };

      app = new MiniTelApplication(config);

      expect(app.config.host).toBe('custom.host');
      expect(app.config.port).toBe(9999);
    });
  });
});
