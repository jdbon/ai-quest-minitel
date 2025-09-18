/**
 * MiniTel-Lite Protocol Constants
 * Version 3.0
 */

// Command codes
const COMMANDS = {
  HELLO: 0x01,
  DUMP: 0x02,
  STOP_CMD: 0x03
};

// Response codes
const RESPONSES = {
  HELLO_ACK: 0x81,
  DUMP_FAILED: 0x82,
  DUMP_OK: 0x83,
  STOP_OK: 0x84
};

// Protocol constants
const PROTOCOL_CONSTANTS = {
  HASH_LENGTH: 32,
  NONCE_LENGTH: 4,
  CMD_LENGTH: 1,
  LENGTH_PREFIX_SIZE: 2,
  CONNECTION_TIMEOUT: 2000, // 2 seconds as per v3.0 spec
  MAX_PAYLOAD_SIZE: 65535
};

// Error types
const PROTOCOL_ERRORS = {
  INVALID_NONCE: 'INVALID_NONCE',
  UNKNOWN_COMMAND: 'UNKNOWN_COMMAND',
  MALFORMED_FRAME: 'MALFORMED_FRAME',
  HASH_VALIDATION_FAILURE: 'HASH_VALIDATION_FAILURE',
  INVALID_BASE64: 'INVALID_BASE64',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  UNEXPECTED_DISCONNECTION: 'UNEXPECTED_DISCONNECTION'
};

// Command names for logging
const COMMAND_NAMES = Object.fromEntries(
  Object.entries(COMMANDS).map(([name, code]) => [code, name])
);

const RESPONSE_NAMES = Object.fromEntries(
  Object.entries(RESPONSES).map(([name, code]) => [code, name])
);

module.exports = {
  COMMANDS,
  RESPONSES,
  PROTOCOL_CONSTANTS,
  PROTOCOL_ERRORS,
  COMMAND_NAMES,
  RESPONSE_NAMES
};
