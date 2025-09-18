/**
 * Jest Setup - Runs after environment setup
 */

// Increase timeout for network-related tests
jest.setTimeout(15000);

// Mock console methods to reduce noise during tests
const originalConsoleError = console.error;
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

// Store original methods for restoration
global.originalConsole = {
  error: originalConsoleError,
  log: originalConsoleLog,
  warn: originalConsoleWarn
};

// Mock console methods unless explicitly testing them
beforeEach(() => {
  if (!process.env.JEST_VERBOSE) {
    console.error = jest.fn();
    console.log = jest.fn();
    console.warn = jest.fn();
  }
});

afterEach(() => {
  // Restore console methods
  if (!process.env.JEST_VERBOSE) {
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
  }

  // Clear all timers
  jest.clearAllTimers();
  jest.useRealTimers();
});

// Global test utilities
global.testUtils = {
  // Wait for a promise to resolve/reject
  waitForPromise: (promise, timeout = 5000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Test timeout')), timeout)
      )
    ]);
  },

  // Create a delay for async testing
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock event emitter for testing
  createMockEventEmitter: () => {
    const events = {};
    return {
      on: jest.fn((event, handler) => {
        if (!events[event]) events[event] = [];
        events[event].push(handler);
      }),
      emit: jest.fn((event, ...args) => {
        if (events[event]) {
          events[event].forEach(handler => handler(...args));
        }
      }),
      removeListener: jest.fn((event, handler) => {
        if (events[event]) {
          const index = events[event].indexOf(handler);
          if (index > -1) events[event].splice(index, 1);
        }
      }),
      removeAllListeners: jest.fn((event) => {
        if (event) {
          events[event] = [];
        } else {
          Object.keys(events).forEach(key => events[key] = []);
        }
      })
    };
  }
};

// Environment variable setup for tests
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';  // Reduce log noise during tests
