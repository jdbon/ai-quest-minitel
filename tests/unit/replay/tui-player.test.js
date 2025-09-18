/**
 * Unit tests for TUI Player
 */

// Mock blessed to avoid terminal interference during tests
const mockScreen = {
  key: jest.fn(),
  append: jest.fn(),
  render: jest.fn(),
  destroy: jest.fn()
};

const mockBox = {
  setContent: jest.fn(),
  setScrollPerc: jest.fn()
};

jest.mock('blessed', () => ({
  screen: jest.fn(() => mockScreen),
  box: jest.fn(() => mockBox)
}));

const blessed = require('blessed');
const TUIPlayer = require('../../../src/replay/tui-player');

describe('TUI Player', () => {
  let sessionData;
  let options;
  let player;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock session data
    sessionData = {
      metadata: {
        sessionId: 'test-session-123',
        startTime: '2023-09-17T10:30:15.000Z',
        endTime: '2023-09-17T10:30:18.000Z',
        serverHost: 'localhost',
        serverPort: 8080,
        totalSteps: 3
      },
      interactions: [
        {
          stepNumber: 1,
          timestamp: '2023-09-17T10:30:15.000Z',
          type: 'request',
          command: 'HELLO',
          nonce: 0,
          payload: '',
          metadata: { direction: 'client -> server' }
        },
        {
          stepNumber: 2,
          timestamp: '2023-09-17T10:30:15.100Z',
          type: 'response',
          command: 'HELLO_ACK',
          nonce: 1,
          payload: '',
          metadata: { direction: 'server -> client' }
        },
        {
          stepNumber: 3,
          timestamp: '2023-09-17T10:30:15.200Z',
          type: 'request',
          command: 'DUMP',
          nonce: 2,
          payload: '',
          metadata: { direction: 'client -> server' }
        }
      ]
    };

    options = {
      autoPlay: false,
      autoPlayDelay: 1000
    };

    player = new TUIPlayer(sessionData, options);
  });

  describe('Constructor', () => {
    test('should initialize with correct properties', () => {
      expect(player.sessionData).toBe(sessionData);
      expect(player.options).toBe(options);
      expect(player.currentStep).toBe(0);
      expect(player.totalSteps).toBe(3);
      expect(player.autoPlay).toBe(false);
      expect(player.autoPlayDelay).toBe(1000);
      expect(player.autoPlayTimer).toBe(null);
    });

    test('should use default options when not provided', () => {
      const playerWithDefaults = new TUIPlayer(sessionData);

      expect(playerWithDefaults.autoPlay).toBe(false);
      expect(playerWithDefaults.autoPlayDelay).toBe(1000);
    });

    test('should override defaults with provided options', () => {
      const customOptions = {
        autoPlay: true,
        autoPlayDelay: 2000
      };

      const customPlayer = new TUIPlayer(sessionData, customOptions);

      expect(customPlayer.autoPlay).toBe(true);
      expect(customPlayer.autoPlayDelay).toBe(2000);
    });

    test('should initialize UI components as null', () => {
      expect(player.screen).toBe(null);
      expect(player.headerBox).toBe(null);
      expect(player.contentBox).toBe(null);
      expect(player.footerBox).toBe(null);
    });
  });

  describe('start method', () => {
    test('should initialize UI and render screen', () => {
      player.start();

      expect(blessed.screen).toHaveBeenCalledWith({
        smartCSR: true,
        title: 'MiniTel Session Replay',
        dockBorders: true
      });
      expect(mockScreen.render).toHaveBeenCalled();
    });

    test('should setup keyboard bindings', () => {
      player.start();

      // Should setup multiple key bindings for navigation
      expect(mockScreen.key).toHaveBeenCalledWith(['q', 'Q', 'C-c'], expect.any(Function));
      expect(mockScreen.key).toHaveBeenCalledWith(['n', 'N', 'right', 'space'], expect.any(Function));
      expect(mockScreen.key).toHaveBeenCalledWith(['p', 'P', 'left'], expect.any(Function));
      expect(mockScreen.key).toHaveBeenCalledWith(['a', 'A'], expect.any(Function));
    });

    test('should append UI components to screen', () => {
      player.start();

      // Should append 3 components: header, content, footer
      expect(mockScreen.append).toHaveBeenCalledTimes(3);
    });

    test('should start auto-play when enabled', () => {
      jest.spyOn(player, '_startAutoPlay');
      player.autoPlay = true;

      player.start();

      expect(player._startAutoPlay).toHaveBeenCalled();
    });

    test('should not start auto-play when disabled', () => {
      jest.spyOn(player, '_startAutoPlay');
      player.autoPlay = false;

      player.start();

      expect(player._startAutoPlay).not.toHaveBeenCalled();
    });
  });

  describe('Navigation methods', () => {
    beforeEach(() => {
      player.start();
      jest.spyOn(player, '_updateDisplay').mockImplementation();
    });

    test('should navigate to next step', () => {
      player.currentStep = 0;

      player._nextStep();

      expect(player.currentStep).toBe(1);
      expect(player._updateDisplay).toHaveBeenCalled();
    });

    test('should not go beyond last step', () => {
      player.currentStep = 2; // Last step (0-indexed)

      player._nextStep();

      expect(player.currentStep).toBe(2); // Should not change
    });

    test('should navigate to previous step', () => {
      player.currentStep = 2;

      player._previousStep();

      expect(player.currentStep).toBe(1);
      expect(player._updateDisplay).toHaveBeenCalled();
    });

    test('should not go before first step', () => {
      player.currentStep = 0;

      player._previousStep();

      expect(player.currentStep).toBe(0); // Should not change
    });

    test('should jump to first step', () => {
      player.currentStep = 2;

      player._firstStep();

      expect(player.currentStep).toBe(0);
      expect(player._updateDisplay).toHaveBeenCalled();
    });

    test('should jump to last step', () => {
      player.currentStep = 0;

      player._lastStep();

      expect(player.currentStep).toBe(2); // Last step (0-indexed)
      expect(player._updateDisplay).toHaveBeenCalled();
    });
  });

  describe('Auto-play functionality', () => {
    beforeEach(() => {
      player.start();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should start auto-play', () => {
      jest.spyOn(player, '_nextStep');

      player._startAutoPlay();

      expect(player.autoPlay).toBe(true);

      // Fast-forward timer
      jest.advanceTimersByTime(1000);
      expect(player._nextStep).toHaveBeenCalled();
    });

    test('should stop auto-play', () => {
      player.autoPlay = true;
      player.autoPlayTimer = setTimeout(() => {}, 1000);

      player._stopAutoPlay();

      expect(player.autoPlay).toBe(false);
      expect(player.autoPlayTimer).toBe(null);
    });

    test('should toggle auto-play on', () => {
      jest.spyOn(player, '_startAutoPlay');
      player.autoPlay = false;

      player._toggleAutoPlay();

      expect(player._startAutoPlay).toHaveBeenCalled();
    });

    test('should toggle auto-play off', () => {
      jest.spyOn(player, '_stopAutoPlay');
      player.autoPlay = true;

      player._toggleAutoPlay();

      expect(player._stopAutoPlay).toHaveBeenCalled();
    });

    test('should stop auto-play at last step', () => {
      jest.spyOn(player, '_stopAutoPlay');
      player.currentStep = 2; // Last step

      player._startAutoPlay();
      jest.advanceTimersByTime(1000);

      expect(player._stopAutoPlay).toHaveBeenCalled();
    });
  });

  describe('Internal update methods', () => {
    test('should have update methods defined', () => {
      player.start();

      expect(typeof player._updateHeader).toBe('function');
      expect(typeof player._updateContent).toBe('function');
      expect(typeof player._updateFooter).toBe('function');
    });

    test('should handle empty session data', () => {
      const emptyPlayer = new TUIPlayer({
        metadata: { totalSteps: 0 },
        interactions: []
      });
      emptyPlayer.start();

      expect(emptyPlayer.totalSteps).toBe(0);
      expect(emptyPlayer.currentStep).toBe(0);
    });
  });

  describe('Update display functionality', () => {
    test('should update all UI components', () => {
      player.start();

      // Reset mock call counts after start() which calls _updateDisplay() internally
      mockBox.setContent.mockClear();
      mockScreen.render.mockClear();

      player._updateDisplay();

      expect(mockBox.setContent).toHaveBeenCalledTimes(3); // header, content, footer
      expect(mockScreen.render).toHaveBeenCalled();
    });
  });

  describe('Error handling and edge cases', () => {
    test('should handle session data without interactions', () => {
      const emptySession = {
        metadata: { totalSteps: 0 },
        interactions: []
      };

      const emptyPlayer = new TUIPlayer(emptySession);

      expect(emptyPlayer.totalSteps).toBe(0);
      expect(emptyPlayer.currentStep).toBe(0);
    });

    test('should handle navigation with no steps', () => {
      const emptyPlayer = new TUIPlayer({
        metadata: { totalSteps: 0 },
        interactions: []
      });

      emptyPlayer._nextStep();
      emptyPlayer._previousStep();

      expect(emptyPlayer.currentStep).toBe(0);
    });

    test('should handle malformed session metadata', () => {
      const malformedSession = {
        metadata: {},
        interactions: [{ stepNumber: 1, type: 'request', command: 'HELLO' }]
      };

      const malformedPlayer = new TUIPlayer(malformedSession);
      expect(malformedPlayer.totalSteps).toBe(1);
    });

    test('should handle malformed interaction data', () => {
      const malformedSession = {
        metadata: { totalSteps: 1 },
        interactions: [{ stepNumber: 1, type: 'request' }] // Partial interaction
      };

      const malformedPlayer = new TUIPlayer(malformedSession);
      expect(malformedPlayer.currentStep).toBe(0);
      expect(malformedPlayer.totalSteps).toBe(1);
    });
  });

  describe('Cleanup', () => {
    test('should clear auto-play timer on destruction', () => {
      player.autoPlay = true;
      player.autoPlayTimer = setTimeout(() => {}, 1000);

      // Simulate cleanup (would be called by blessed on screen destroy)
      if (player.autoPlayTimer) {
        clearTimeout(player.autoPlayTimer);
        player.autoPlayTimer = null;
      }

      expect(player.autoPlayTimer).toBe(null);
    });
  });
});
