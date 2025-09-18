/**
 * MiniTel-Lite Protocol Client
 * Handles connection, nonce tracking, and command/response flow
 */

const net = require('net');
const EventEmitter = require('events');
const {
  COMMANDS,
  RESPONSES,
  PROTOCOL_CONSTANTS,
  PROTOCOL_ERRORS,
  RESPONSE_NAMES
} = require('./constants');
const { encodeFrame, decodeFrame, getExpectedFrameLength } = require('./frame');

class MiniTelClient extends EventEmitter {
  constructor(options = {}) {
    super();

    this.host = options.host || 'localhost';
    this.port = options.port || 8080;
    this.timeout = options.timeout || PROTOCOL_CONSTANTS.CONNECTION_TIMEOUT;

    this.socket = null;
    this.isConnected = false;
    this.currentNonce = 0;
    this.lastCommand = null;
    this.dumpCounter = 0;

    this.incomingBuffer = Buffer.alloc(0);
    this.connectionTimer = null;
  }

  /**
   * Connect to the MiniTel-Lite server
   * @returns {Promise<void>}
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();

      // Set up connection timeout
      this.connectionTimer = setTimeout(() => {
        this.socket.destroy();
        this.emit('error', new Error(PROTOCOL_ERRORS.CONNECTION_TIMEOUT));
        reject(new Error(PROTOCOL_ERRORS.CONNECTION_TIMEOUT));
      }, this.timeout);

      this.socket.connect(this.port, this.host, () => {
        clearTimeout(this.connectionTimer);
        this.isConnected = true;
        this.currentNonce = 0;
        this.lastCommand = null;
        this.dumpCounter = 0;
        this.incomingBuffer = Buffer.alloc(0);

        this.emit('connected');
        resolve();
      });

      this.socket.on('data', (data) => {
        this._handleIncomingData(data);
      });

      this.socket.on('close', () => {
        this.isConnected = false;
        clearTimeout(this.connectionTimer);
        this.emit('disconnected');
      });

      this.socket.on('error', (error) => {
        this.isConnected = false;
        clearTimeout(this.connectionTimer);
        this.emit('error', error);
        reject(error);
      });
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect() {
    if (this.socket) {
      this.socket.end();
      this.socket = null;
    }
    this.isConnected = false;
    clearTimeout(this.connectionTimer);
  }

  /**
   * Send HELLO command to initialize connection
   * @returns {Promise<Object>} Response frame
   */
  async sendHello() {
    if (!this.isConnected) {
      throw new Error('Not connected to server');
    }

    const frame = encodeFrame(COMMANDS.HELLO, this.currentNonce, '');
    this.lastCommand = 'HELLO';

    this.emit('frameTransmitted', {
      type: 'request',
      command: 'HELLO',
      nonce: this.currentNonce,
      payload: '',
      timestamp: new Date().toISOString()
    });

    return this._sendFrameAndWaitForResponse(frame, RESPONSES.HELLO_ACK);
  }

  /**
   * Send DUMP command to request memory dump
   * @returns {Promise<Object>} Response frame
   */
  async sendDump() {
    if (!this.isConnected) {
      throw new Error('Not connected to server');
    }

    // Check if HELLO has been sent (either lastCommand is HELLO or we've done successful DUMPs)
    if (this.lastCommand === null) {
      throw new Error('HELLO command must be sent before DUMP');
    }

    const frame = encodeFrame(COMMANDS.DUMP, this.currentNonce, '');
    this.lastCommand = 'DUMP';

    this.emit('frameTransmitted', {
      type: 'request',
      command: 'DUMP',
      nonce: this.currentNonce,
      payload: '',
      timestamp: new Date().toISOString()
    });

    // DUMP can respond with either DUMP_OK or DUMP_FAILED
    return this._sendFrameAndWaitForResponse(frame, [RESPONSES.DUMP_OK, RESPONSES.DUMP_FAILED]);
  }

  /**
   * Send STOP_CMD to gracefully terminate connection
   * @returns {Promise<Object>} Response frame
   */
  async sendStop() {
    if (!this.isConnected) {
      throw new Error('Not connected to server');
    }

    const frame = encodeFrame(COMMANDS.STOP_CMD, this.currentNonce, '');
    this.lastCommand = 'STOP_CMD';

    this.emit('frameTransmitted', {
      type: 'request',
      command: 'STOP_CMD',
      nonce: this.currentNonce,
      payload: '',
      timestamp: new Date().toISOString()
    });

    return this._sendFrameAndWaitForResponse(frame, RESPONSES.STOP_OK);
  }

  /**
   * Send frame and wait for response
   * @private
   * @param {Buffer} frame - Encoded frame to send
   * @param {number|Array} expectedResponseCodes - Expected response code(s)
   * @returns {Promise<Object>} Response frame
   */
  _sendFrameAndWaitForResponse(frame, expectedResponseCodes) {
    return new Promise((resolve, reject) => {
      const expectedCodes = Array.isArray(expectedResponseCodes)
        ? expectedResponseCodes
        : [expectedResponseCodes];

      const responseHandler = (responseFrame) => {
        if (expectedCodes.includes(responseFrame.cmd)) {
          this.removeListener('frameReceived', responseHandler);
          this.removeListener('error', errorHandler);
          this.removeListener('disconnected', disconnectHandler);
          resolve(responseFrame);
        }
      };

      const errorHandler = (error) => {
        this.removeListener('frameReceived', responseHandler);
        this.removeListener('error', errorHandler);
        this.removeListener('disconnected', disconnectHandler);
        reject(error);
      };

      const disconnectHandler = () => {
        this.removeListener('frameReceived', responseHandler);
        this.removeListener('error', errorHandler);
        this.removeListener('disconnected', disconnectHandler);
        reject(new Error(PROTOCOL_ERRORS.UNEXPECTED_DISCONNECTION));
      };

      this.on('frameReceived', responseHandler);
      this.on('error', errorHandler);
      this.on('disconnected', disconnectHandler);

      // Send the frame
      this.socket.write(frame);
      this.currentNonce += 2; // Client increments by 2 (server response will be +1)
    });
  }

  /**
   * Handle incoming data and frame processing
   *
   * This is one of the most critical methods in the protocol implementation.
   * It handles the complex scenario where TCP data arrives in arbitrary chunks
   * and must be reassembled into complete protocol frames.
   *
   * Key challenges addressed:
   * 1. Partial frame reception (frame split across multiple TCP packets)
   * 2. Multiple frames in single data event (TCP coalescing)
   * 3. Frame boundary detection using length prefixes
   * 4. Protocol validation and error recovery
   * 5. Nonce sequence validation for security
   *
   * @private
   * @param {Buffer} data - Incoming data chunk from TCP socket
   */
  _handleIncomingData(data) {
    // Accumulate incoming data in buffer to handle partial frames
    // This is essential because TCP is a stream protocol - frame boundaries
    // are not preserved and data can arrive in arbitrary chunks
    this.incomingBuffer = Buffer.concat([this.incomingBuffer, data]);

    // Process all complete frames in the buffer
    // We use a while loop because a single data event might contain
    // multiple complete frames (TCP coalescing optimization)
    while (this.incomingBuffer.length >= PROTOCOL_CONSTANTS.LENGTH_PREFIX_SIZE) {
      // Step 1: Check if we can read the length prefix (first 2 bytes)
      // Without this, we can't determine frame boundaries
      const expectedLength = getExpectedFrameLength(this.incomingBuffer);

      // Step 2: Wait for complete frame if we don't have enough data yet
      if (expectedLength === null || this.incomingBuffer.length < expectedLength) {
        break; // Exit loop and wait for more data
      }

      // Step 3: Extract exactly one complete frame from buffer
      const frameData = this.incomingBuffer.subarray(0, expectedLength);
      this.incomingBuffer = this.incomingBuffer.subarray(expectedLength);

      try {
        // Step 4: Decode and validate the complete frame
        // This includes Base64 decoding, hash validation, and structure checks
        const decodedFrame = decodeFrame(frameData);

        // Step 5: Critical security check - validate nonce sequence
        // The MiniTel protocol requires strict nonce ordering:
        // Client sends even nonces (0,2,4...), server responds with odd nonces (1,3,5...)
        // Any deviation indicates protocol violation or potential attack
        if (decodedFrame.nonce !== this.currentNonce - 1) {
          this.emit('error', new Error(PROTOCOL_ERRORS.INVALID_NONCE));
          return; // Immediate disconnection on nonce violation
        }

        // Step 6: Update application state based on successful response
        // Track successful DUMP operations for application logic
        if (decodedFrame.cmd === RESPONSES.DUMP_OK) {
          this.dumpCounter++;
        }

        // Step 7: Emit events for application layer and session recording
        // The event-driven architecture allows loose coupling between
        // protocol handling and application logic
        const responseType = RESPONSE_NAMES[decodedFrame.cmd] || 'UNKNOWN';

        this.emit('frameTransmitted', {
          type: 'response',
          command: responseType,
          nonce: decodedFrame.nonce,
          payload: decodedFrame.payloadString,
          timestamp: new Date().toISOString()
        });

        this.emit('frameReceived', decodedFrame);

      } catch (error) {
        // Step 8: Handle any protocol violations or decoding errors
        // All protocol errors result in immediate disconnection as per spec
        this.emit('error', error);
        return;
      }
    }
  }

  /**
   * Get current connection state
   * @returns {Object} Connection state
   */
  getState() {
    return {
      isConnected: this.isConnected,
      currentNonce: this.currentNonce,
      lastCommand: this.lastCommand,
      dumpCounter: this.dumpCounter,
      host: this.host,
      port: this.port
    };
  }
}

module.exports = MiniTelClient;
