/**
 * Mock Network Socket for Testing
 * Simulates TCP socket behavior for unit tests
 */

const { EventEmitter } = require('events');

class MockSocket extends EventEmitter {
  constructor(options = {}) {
    super();
    this.isConnected = false;
    this.destroyed = false;
    this.writtenData = [];
    this.mockOptions = {
      shouldConnect: options.shouldConnect !== false,
      connectDelay: options.connectDelay || 0,
      shouldDisconnect: options.shouldDisconnect || false,
      disconnectDelay: options.disconnectDelay || 1000,
      responseDelay: options.responseDelay || 10,
      shouldTimeout: options.shouldTimeout || false,
      timeoutDelay: options.timeoutDelay || 2000,
      mockResponses: options.mockResponses || [],
      ...options
    };
    this.responseIndex = 0;
  }

  connect(port, host, callback) {
    setTimeout(() => {
      if (this.mockOptions.shouldConnect && !this.destroyed) {
        this.isConnected = true;
        this.emit('connect');
        if (callback) callback();
      } else {
        const error = new Error('ECONNREFUSED');
        error.code = 'ECONNREFUSED';
        error.syscall = 'connect';
        this.emit('error', error);
      }
    }, this.mockOptions.connectDelay);

    // Setup automatic disconnection if configured
    if (this.mockOptions.shouldDisconnect) {
      setTimeout(() => {
        if (this.isConnected && !this.destroyed) {
          this.isConnected = false;
          this.emit('close');
        }
      }, this.mockOptions.disconnectDelay);
    }

    // Setup timeout if configured
    if (this.mockOptions.shouldTimeout) {
      setTimeout(() => {
        if (!this.isConnected && !this.destroyed) {
          const error = new Error('Connection timeout');
          error.code = 'ETIMEDOUT';
          this.emit('error', error);
        }
      }, this.mockOptions.timeoutDelay);
    }

    return this;
  }

  write(data, encoding, callback) {
    if (this.destroyed || !this.isConnected) {
      const error = new Error('Socket is not connected');
      if (callback) callback(error);
      return false;
    }

    // Store written data for verification
    this.writtenData.push(data);

    // Simulate response if configured
    if (this.mockOptions.mockResponses.length > 0 && this.responseIndex < this.mockOptions.mockResponses.length) {
      const response = this.mockOptions.mockResponses[this.responseIndex];
      this.responseIndex++;

      setTimeout(() => {
        if (this.isConnected && !this.destroyed) {
          if (response instanceof Error) {
            this.emit('error', response);
          } else {
            this.emit('data', response);
          }
        }
      }, this.mockOptions.responseDelay);
    }

    if (callback) callback();
    return true;
  }

  end(data, encoding, callback) {
    if (data) {
      this.write(data, encoding);
    }

    setTimeout(() => {
      this.isConnected = false;
      this.emit('close');
      if (callback) callback();
    }, 10);
  }

  destroy() {
    this.destroyed = true;
    this.isConnected = false;
    this.emit('close');
  }

  // Test utilities
  simulateData(data) {
    if (this.isConnected && !this.destroyed) {
      this.emit('data', data);
    }
  }

  simulateError(error) {
    this.emit('error', error);
  }

  simulateDisconnect() {
    if (this.isConnected) {
      this.isConnected = false;
      this.emit('close');
    }
  }

  getWrittenData() {
    return this.writtenData;
  }

  clearWrittenData() {
    this.writtenData = [];
  }
}

// Mock the net module
const netMock = {
  Socket: MockSocket,
  createConnection: (options, callback) => {
    const socket = new MockSocket(options);
    if (typeof options === 'object') {
      return socket.connect(options.port, options.host, callback);
    } else {
      return socket.connect(options, callback);
    }
  }
};

module.exports = { MockSocket, netMock };
