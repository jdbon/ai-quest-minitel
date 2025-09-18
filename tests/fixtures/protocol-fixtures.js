/**
 * Protocol Test Fixtures
 * Pre-defined protocol frames and test data for consistent testing
 */

const { COMMANDS, RESPONSES } = require('../../src/protocol/constants');
const { encodeFrame } = require('../../src/protocol/frame');

// Valid protocol frames for testing
const VALID_FRAMES = {
  // HELLO command
  HELLO_REQUEST: {
    cmd: COMMANDS.HELLO,
    nonce: 0,
    payload: '',
    expectedResponse: RESPONSES.HELLO_ACK
  },

  // DUMP commands
  DUMP_REQUEST_FIRST: {
    cmd: COMMANDS.DUMP,
    nonce: 2,
    payload: '',
    expectedResponse: [RESPONSES.DUMP_OK, RESPONSES.DUMP_FAILED]
  },

  DUMP_REQUEST_SECOND: {
    cmd: COMMANDS.DUMP,
    nonce: 4,
    payload: '',
    expectedResponse: [RESPONSES.DUMP_OK, RESPONSES.DUMP_FAILED]
  },

  // STOP command
  STOP_REQUEST: {
    cmd: COMMANDS.STOP_CMD,
    nonce: 6,
    payload: '',
    expectedResponse: RESPONSES.STOP_OK
  }
};

// Valid responses for testing
const VALID_RESPONSES = {
  HELLO_ACK: {
    cmd: RESPONSES.HELLO_ACK,
    nonce: 1,
    payload: ''
  },

  DUMP_OK: {
    cmd: RESPONSES.DUMP_OK,
    nonce: 3,
    payload: 'SECRET_CODE_12345'
  },

  DUMP_FAILED: {
    cmd: RESPONSES.DUMP_FAILED,
    nonce: 3,
    payload: ''
  },

  STOP_OK: {
    cmd: RESPONSES.STOP_OK,
    nonce: 7,
    payload: ''
  }
};

// Invalid frames for error testing
const INVALID_FRAMES = {
  // Invalid command
  UNKNOWN_COMMAND: {
    cmd: 0xFF,
    nonce: 0,
    payload: '',
    expectedError: 'UNKNOWN_COMMAND'
  },

  // Invalid nonce sequence
  WRONG_NONCE: {
    cmd: COMMANDS.HELLO,
    nonce: 999,
    payload: '',
    expectedError: 'INVALID_NONCE'
  },

  // Payload too large
  OVERSIZED_PAYLOAD: {
    cmd: COMMANDS.HELLO,
    nonce: 0,
    payload: 'x'.repeat(65536), // Exceeds max payload size
    expectedError: 'PAYLOAD_TOO_LARGE'
  }
};

// Malformed binary data for testing
const MALFORMED_DATA = {
  // Invalid Base64 - create data that will actually cause Base64.from() to throw
  INVALID_BASE64: (() => {
    // Create a frame with invalid Base64 characters that will definitely cause Buffer.from() to throw
    // Using characters that are not valid in Base64 alphabet
    const invalidBase64String = '!!!@#$%^&*(';
    const invalidBase64Buffer = Buffer.from(invalidBase64String, 'ascii');

    // Create frame with length prefix
    const lengthPrefix = Buffer.alloc(2);
    lengthPrefix.writeUInt16BE(invalidBase64Buffer.length, 0);

    return Buffer.concat([lengthPrefix, invalidBase64Buffer]);
  })(),

  // Truncated frame
  TRUNCATED_FRAME: Buffer.from([0x00, 0x04, 0x41, 0x42]), // Says 4 bytes but only has 2

  // Empty frame
  EMPTY_FRAME: Buffer.from([0x00, 0x00]),

  // Frame too short
  TOO_SHORT: Buffer.from([0x00, 0x01, 0x41]) // Too short to contain all required fields
};

// Test scenarios for different connection states
const CONNECTION_SCENARIOS = {
  SUCCESSFUL_HELLO: {
    description: 'Successful HELLO handshake',
    clientSends: VALID_FRAMES.HELLO_REQUEST,
    serverResponds: VALID_RESPONSES.HELLO_ACK,
    expectedState: { isConnected: true, currentNonce: 2 }
  },

  SUCCESSFUL_DUMP_SEQUENCE: {
    description: 'Complete HELLO + 2x DUMP sequence',
    sequence: [
      {
        clientSends: VALID_FRAMES.HELLO_REQUEST,
        serverResponds: VALID_RESPONSES.HELLO_ACK
      },
      {
        clientSends: VALID_FRAMES.DUMP_REQUEST_FIRST,
        serverResponds: VALID_RESPONSES.DUMP_FAILED
      },
      {
        clientSends: VALID_FRAMES.DUMP_REQUEST_SECOND,
        serverResponds: VALID_RESPONSES.DUMP_OK
      }
    ],
    expectedState: { dumpCounter: 1, finalNonce: 6 }
  },

  CONNECTION_REFUSED: {
    description: 'Server refuses connection',
    connectionError: { code: 'ECONNREFUSED', message: 'Connection refused' }
  },

  UNEXPECTED_DISCONNECTION: {
    description: 'Server disconnects during operation',
    disconnectAfter: 'HELLO_ACK',
    expectedError: 'UNEXPECTED_DISCONNECTION'
  },

  TIMEOUT: {
    description: 'Connection timeout',
    connectionError: { code: 'ETIMEDOUT', message: 'Connection timed out' }
  }
};

// Protocol validation test cases
const VALIDATION_TESTS = {
  HASH_VALIDATION: {
    description: 'Hash validation failure',
    frame: {
      cmd: COMMANDS.HELLO,
      nonce: 0,
      payload: '',
      corruptHash: true
    },
    expectedError: 'HASH_VALIDATION_FAILURE'
  },

  NONCE_SEQUENCE: {
    description: 'Nonce sequence validation',
    steps: [
      { clientNonce: 0, serverNonce: 1, valid: true },
      { clientNonce: 2, serverNonce: 3, valid: true },
      { clientNonce: 4, serverNonce: 3, valid: false }, // Wrong server nonce
      { clientNonce: 6, serverNonce: 5, valid: false }  // Wrong sequence
    ]
  }
};

// Session recording test data
const SESSION_RECORDING_DATA = {
  COMPLETE_SESSION: {
    metadata: {
      sessionId: 'test_session_123',
      startTime: '2023-09-17T10:30:00.000Z',
      endTime: '2023-09-17T10:30:05.000Z',
      totalSteps: 6,
      serverHost: 'localhost',
      serverPort: 8080,
      protocolVersion: '3.0'
    },
    interactions: [
      {
        stepNumber: 1,
        timestamp: '2023-09-17T10:30:00.100Z',
        type: 'request',
        command: 'HELLO',
        nonce: 0,
        payload: ''
      },
      {
        stepNumber: 2,
        timestamp: '2023-09-17T10:30:00.120Z',
        type: 'response',
        command: 'HELLO_ACK',
        nonce: 1,
        payload: ''
      }
      // ... more interactions would be here
    ]
  }
};

/**
 * Generate encoded frame buffer for testing
 * @param {Object} frameData - Frame data to encode
 * @returns {Buffer} Encoded frame
 */
function generateEncodedFrame(frameData) {
  return encodeFrame(frameData.cmd, frameData.nonce, frameData.payload);
}

/**
 * Generate malformed frame with corrupted hash
 * @param {Object} frameData - Base frame data
 * @returns {Buffer} Frame with corrupted hash
 */
function generateCorruptedFrame(frameData) {
  const validFrame = generateEncodedFrame(frameData);
  // Corrupt the last byte (part of hash)
  validFrame[validFrame.length - 1] = validFrame[validFrame.length - 1] ^ 0xFF;
  return validFrame;
}

module.exports = {
  VALID_FRAMES,
  VALID_RESPONSES,
  INVALID_FRAMES,
  MALFORMED_DATA,
  CONNECTION_SCENARIOS,
  VALIDATION_TESTS,
  SESSION_RECORDING_DATA,
  generateEncodedFrame,
  generateCorruptedFrame
};
