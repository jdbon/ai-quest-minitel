/**
 * Unit tests for Interactive TUI
 */

// Mock blessed to avoid terminal interference during tests
const mockScreen = {
  key: jest.fn(),
  append: jest.fn(),
  render: jest.fn(),
  destroy: jest.fn()
};

const mockBox = {
  setContent: jest.fn()
};

const mockLog = {
  log: jest.fn(),
  focus: jest.fn(),
  scroll: jest.fn()
};

const mockMessage = {
  display: jest.fn()
};

jest.mock('blessed', () => ({
  screen: jest.fn(() => mockScreen),
  box: jest.fn(() => mockBox),
  log: jest.fn(() => mockLog),
  message: jest.fn(() => mockMessage)
}));

const blessed = require('blessed');
const InteractiveTUI = require('../../../src/client/interactive-tui');
const { RESPONSES } = require('../../../src/protocol/constants');

describe('Interactive TUI', () => {
  let mockClient;
  let tui;
  let options;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock client
    mockClient = {
      isConnected: false,
      on: jest.fn(),
      sendHello: jest.fn(),
      sendDump: jest.fn(),
      sendStop: jest.fn()
    };

    // Default options
    options = {
      host: 'localhost',
      port: 8080,
      record: false,
      onExit: jest.fn()
    };

    tui = new InteractiveTUI(mockClient, options);
  });

  describe('Constructor', () => {
    test('should initialize with correct properties', () => {
      expect(tui.client).toBe(mockClient);
      expect(tui.options).toBe(options);
      expect(tui.isRunning).toBe(false);
      expect(tui.connectionStatus).toBe('disconnected');
      expect(tui.lastNonce).toBe(0);
      expect(tui.dumpCount).toBe(0);
      expect(tui.helloSent).toBe(false);
    });

    test('should set default onExit callback if not provided', () => {
      const tuiWithoutCallback = new InteractiveTUI(mockClient, { host: 'test' });
      expect(typeof tuiWithoutCallback.onExit).toBe('function');
    });

    test('should initialize logs array and UI components as null', () => {
      expect(tui.logs).toEqual([]);
      expect(tui.screen).toBe(null);
      expect(tui.headerBox).toBe(null);
      expect(tui.statusBox).toBe(null);
      expect(tui.logBox).toBe(null);
      expect(tui.commandBox).toBe(null);
      expect(tui.footerBox).toBe(null);
    });
  });

  describe('start method', () => {
    test('should initialize UI and set running state', () => {
      tui.start();

      expect(tui.isRunning).toBe(true);
      expect(blessed.screen).toHaveBeenCalledWith({
        smartCSR: true,
        title: 'MiniTel Interactive Client',
        dockBorders: true
      });
      expect(mockScreen.render).toHaveBeenCalled();
    });

    test('should setup client event handlers', () => {
      tui.start();

      expect(mockClient.on).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('disconnected', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('frameReceived', expect.any(Function));
    });

    test('should append all UI components to screen', () => {
      tui.start();

      // Should append 5 components: header, status, command, log, footer
      expect(mockScreen.append).toHaveBeenCalledTimes(5);
      expect(mockLog.focus).toHaveBeenCalled();
    });

    test('should setup keyboard bindings', () => {
      tui.start();

      // Should setup multiple key bindings
      expect(mockScreen.key).toHaveBeenCalledWith(['escape', 'q', 'Q', 'C-c'], expect.any(Function));
      expect(mockScreen.key).toHaveBeenCalledWith(['?', 'h', 'H'], expect.any(Function));
      expect(mockScreen.key).toHaveBeenCalledWith(['d', 'D'], expect.any(Function));
      expect(mockScreen.key).toHaveBeenCalledWith(['s', 'S'], expect.any(Function));
    });
  });

  describe('stop method', () => {
    test('should set running state and destroy screen', () => {
      tui.start();
      tui.stop();

      expect(tui.isRunning).toBe(false);
      expect(mockScreen.destroy).toHaveBeenCalled();
    });

    test('should handle stop when screen is null', () => {
      tui.stop();

      expect(tui.isRunning).toBe(false);
      expect(mockScreen.destroy).not.toHaveBeenCalled();
    });
  });

  describe('Client event handlers', () => {
    beforeEach(() => {
      tui.start();
    });

    test('should handle connected event', () => {
      const connectHandler = mockClient.on.mock.calls.find(call => call[0] === 'connected')[1];

      connectHandler();

      expect(tui.connectionStatus).toBe('connected');
    });

    test('should handle disconnected event', () => {
      tui.connectionStatus = 'connected';
      const disconnectHandler = mockClient.on.mock.calls.find(call => call[0] === 'disconnected')[1];

      disconnectHandler();

      expect(tui.connectionStatus).toBe('disconnected');
    });

    test('should handle frameReceived event with DUMP_OK', () => {
      const frameHandler = mockClient.on.mock.calls.find(call => call[0] === 'frameReceived')[1];
      const frame = {
        cmd: RESPONSES.DUMP_OK,
        nonce: 3
      };

      frameHandler(frame);

      expect(tui.lastNonce).toBe(3);
      expect(tui.dumpCount).toBe(1);
    });

    test('should handle frameReceived event with other responses', () => {
      const frameHandler = mockClient.on.mock.calls.find(call => call[0] === 'frameReceived')[1];
      const frame = {
        cmd: RESPONSES.HELLO_ACK,
        nonce: 1
      };

      frameHandler(frame);

      expect(tui.lastNonce).toBe(1);
      expect(tui.dumpCount).toBe(0); // Should not increment for non-DUMP_OK
    });
  });

  describe('Command sending methods', () => {
    beforeEach(() => {
      tui.start();
      mockClient.isConnected = true;
    });

    test('should send HELLO command successfully', async() => {
      mockClient.sendHello.mockResolvedValue({ nonce: 1 });

      await tui._sendHello();

      expect(mockClient.sendHello).toHaveBeenCalled();
      expect(tui.helloSent).toBe(true);
    });

    test('should handle HELLO command failure', async() => {
      mockClient.sendHello.mockRejectedValue(new Error('Connection failed'));

      await tui._sendHello();

      expect(mockClient.sendHello).toHaveBeenCalled();
      expect(tui.helloSent).toBe(false);
    });

    test('should send DUMP command successfully', async() => {
      tui.helloSent = true;
      mockClient.sendDump.mockResolvedValue({
        cmd: RESPONSES.DUMP_OK,
        nonce: 3,
        payloadString: 'test-data'
      });

      await tui._sendDump();

      expect(mockClient.sendDump).toHaveBeenCalled();
    });

    test('should handle DUMP command failure', async() => {
      tui.helloSent = true;
      mockClient.sendDump.mockRejectedValue(new Error('DUMP failed'));

      await tui._sendDump();

      expect(mockClient.sendDump).toHaveBeenCalled();
    });

    test('should send STOP command successfully', async() => {
      mockClient.sendStop.mockResolvedValue({ nonce: 5 });

      await tui._sendStop();

      expect(mockClient.sendStop).toHaveBeenCalled();
    });
  });

  describe('Content generation methods', () => {
    test('should generate header content with server info', () => {
      const header = tui._getHeaderContent();

      expect(header).toContain('MiniTel Interactive Client v1.0.0');
      expect(header).toContain('localhost:8080');
      expect(header).toContain('❌'); // Recording disabled
    });

    test('should generate header content with recording enabled', () => {
      tui.options.record = true;

      const header = tui._getHeaderContent();

      expect(header).toContain('✅'); // Recording enabled
    });

    test('should generate status content when disconnected', () => {
      tui.connectionStatus = 'disconnected';

      const status = tui._getStatusContent();

      expect(status).toContain('🔴');
      expect(status).toContain('DISCONNECTED');
      expect(status).toContain('HELLO sent: ❌');
      expect(status).toContain('Successful DUMPs: 0');
    });

    test('should generate status content when connected', () => {
      tui.connectionStatus = 'connected';
      tui.helloSent = true;
      tui.dumpCount = 2;
      tui.lastNonce = 5;

      const status = tui._getStatusContent();

      expect(status).toContain('🟢');
      expect(status).toContain('CONNECTED');
      expect(status).toContain('HELLO sent: ✅');
      expect(status).toContain('Successful DUMPs: 2');
      expect(status).toContain('Last nonce: 5');
    });

    test('should generate command help content', () => {
      const help = tui._getCommandHelp();

      expect(help).toContain('Available Commands');
      expect(help).toContain('[H]');
      expect(help).toContain('[D]');
      expect(help).toContain('[S]');
      expect(help).toContain('[Q]');
    });

    test('should generate detailed help content', () => {
      const help = tui._getDetailedHelp();

      expect(help).toContain('MiniTel Interactive Client Help');
      expect(help).toContain('Protocol Commands');
      expect(help).toContain('Navigation');
      expect(help).toContain('Protocol Flow');
    });
  });

  describe('Logging functionality', () => {
    test('should add timestamped log entries', () => {
      tui.start();

      // Get initial log count
      const initialLogCount = tui.logs.length;

      const message = 'Test log message';
      tui._log(message);

      expect(tui.logs.length).toBe(initialLogCount + 1);
      expect(tui.logs[tui.logs.length - 1]).toContain(message);
      expect(mockLog.log).toHaveBeenCalledWith(expect.stringContaining(message));
    });

    test('should accumulate multiple log entries', () => {
      tui.start();

      const initialLogCount = tui.logs.length;

      tui._log('First message');
      tui._log('Second message');

      expect(tui.logs.length).toBe(initialLogCount + 2);
      expect(mockLog.log).toHaveBeenCalledWith(expect.stringContaining('First message'));
      expect(mockLog.log).toHaveBeenCalledWith(expect.stringContaining('Second message'));
    });
  });

  describe('Update display functionality', () => {
    test('should update all UI components', () => {
      tui.start();

      tui._updateDisplay();

      expect(mockBox.setContent).toHaveBeenCalled(); // At least some boxes updated
      expect(mockScreen.render).toHaveBeenCalled();
    });

    test('should handle update display when screen is null', () => {
      tui._updateDisplay();

      // Should not throw when screen is null
      expect(tui.screen).toBe(null);
    });
  });

  describe('Error handling and edge cases', () => {
    test('should handle client errors gracefully', () => {
      tui.start();
      const errorHandler = mockClient.on.mock.calls.find(call => call[0] === 'error')[1];

      errorHandler(new Error('Test error'));

      // Should not throw and should add error to logs
      expect(tui.logs.some(log => log.includes('Test error'))).toBe(true);
    });

    test('should prevent commands when not connected', () => {
      mockClient.isConnected = false;
      tui.start();

      const helloKeyHandler = mockScreen.key.mock.calls.find(call =>
        call[0].includes('h') || call[0].includes('H')
      )[1];

      helloKeyHandler();

      expect(mockClient.sendHello).not.toHaveBeenCalled();
    });

    test('should prevent DUMP when HELLO not sent', () => {
      mockClient.isConnected = true;
      tui.helloSent = false;
      tui.start();

      const dumpKeyHandler = mockScreen.key.mock.calls.find(call =>
        call[0].includes('d') || call[0].includes('D')
      )[1];

      dumpKeyHandler();

      expect(mockClient.sendDump).not.toHaveBeenCalled();
    });
  });
});
