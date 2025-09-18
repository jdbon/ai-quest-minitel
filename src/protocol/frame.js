/**
 * MiniTel-Lite Protocol Frame Encoder/Decoder
 * Handles binary frame structure and Base64 encoding
 */

const crypto = require('crypto');
const { PROTOCOL_CONSTANTS, PROTOCOL_ERRORS } = require('./constants');

/**
 * Calculate SHA-256 hash of the frame content (CMD + NONCE + PAYLOAD)
 * @param {number} cmd - Command byte
 * @param {number} nonce - 4-byte nonce (big-endian)
 * @param {Buffer} payload - Payload data
 * @returns {Buffer} 32-byte SHA-256 hash
 */
function calculateHash(cmd, nonce, payload) {
  const frameContent = Buffer.alloc(1 + PROTOCOL_CONSTANTS.NONCE_LENGTH + payload.length);
  let offset = 0;

  // Write CMD (1 byte)
  frameContent.writeUInt8(cmd, offset);
  offset += 1;

  // Write NONCE (4 bytes, big-endian)
  frameContent.writeUInt32BE(nonce, offset);
  offset += PROTOCOL_CONSTANTS.NONCE_LENGTH;

  // Write PAYLOAD
  if (payload.length > 0) {
    payload.copy(frameContent, offset);
  }

  return crypto.createHash('sha256').update(frameContent).digest();
}

/**
 * Encode a frame according to MiniTel-Lite protocol v3.0
 *
 * This function implements the complete MiniTel-Lite wire format encoding:
 * 1. Constructs binary frame: CMD + NONCE + PAYLOAD + HASH
 * 2. Calculates SHA-256 hash for integrity verification
 * 3. Applies Base64 encoding as per protocol specification
 * 4. Adds length prefix for frame boundary detection
 *
 * Wire Format:
 * LEN (2 bytes, big-endian) | DATA_B64 (LEN bytes, Base64 encoded)
 *
 * Binary Frame (before Base64):
 * CMD (1 byte) | NONCE (4 bytes, big-endian) | PAYLOAD (0-65535 bytes) | HASH (32 bytes)
 *
 * @param {number} cmd - Command byte (see COMMANDS constants)
 * @param {number} nonce - 4-byte nonce for sequence tracking (big-endian)
 * @param {string|Buffer} payload - Payload data (will be converted to UTF-8 if string)
 * @returns {Buffer} Complete encoded frame with length prefix, ready for network transmission
 */
function encodeFrame(cmd, nonce, payload = '') {
  // Step 1: Normalize payload to Buffer for consistent handling
  // Support both string (UTF-8) and binary Buffer payloads
  const payloadBuffer = typeof payload === 'string'
    ? Buffer.from(payload, 'utf8')
    : payload;

  // Step 2: Enforce protocol payload size limits (security measure)
  // Prevents memory exhaustion and ensures protocol compliance
  if (payloadBuffer.length > PROTOCOL_CONSTANTS.MAX_PAYLOAD_SIZE) {
    throw new Error(`Payload size exceeds maximum: ${payloadBuffer.length} > ${PROTOCOL_CONSTANTS.MAX_PAYLOAD_SIZE}`);
  }

  // Step 3: Calculate cryptographic hash for frame integrity
  // Hash includes CMD + NONCE + PAYLOAD (excludes the hash itself)
  // This prevents tampering and ensures frame integrity over unreliable networks
  const hash = calculateHash(cmd, nonce, payloadBuffer);

  // Step 4: Allocate buffer for complete binary frame
  // Pre-calculate total size to avoid buffer reallocations
  const frameSize = PROTOCOL_CONSTANTS.CMD_LENGTH + PROTOCOL_CONSTANTS.NONCE_LENGTH + payloadBuffer.length + PROTOCOL_CONSTANTS.HASH_LENGTH;
  const binaryFrame = Buffer.alloc(frameSize);
  let offset = 0;

  // Step 5: Write frame components in exact protocol order

  // Write CMD (1 byte) - identifies the command type
  binaryFrame.writeUInt8(cmd, offset);
  offset += PROTOCOL_CONSTANTS.CMD_LENGTH;

  // Write NONCE (4 bytes, big-endian) - critical for sequence validation
  // Big-endian ensures consistent byte order across different architectures
  binaryFrame.writeUInt32BE(nonce, offset);
  offset += PROTOCOL_CONSTANTS.NONCE_LENGTH;

  // Write PAYLOAD (variable length) - the actual command data
  if (payloadBuffer.length > 0) {
    payloadBuffer.copy(binaryFrame, offset);
    offset += payloadBuffer.length;
  }

  // Write HASH (32 bytes) - SHA-256 digest for integrity verification
  hash.copy(binaryFrame, offset);

  // Step 6: Apply Base64 encoding as required by protocol
  // Base64 ensures binary data can be transmitted over text-based transports
  const base64Frame = binaryFrame.toString('base64');
  const base64Buffer = Buffer.from(base64Frame, 'ascii');

  // Step 7: Construct final frame with length prefix
  // Length prefix enables frame boundary detection in TCP stream
  const finalFrame = Buffer.alloc(PROTOCOL_CONSTANTS.LENGTH_PREFIX_SIZE + base64Buffer.length);

  // Write length prefix (2 bytes, big-endian) - specifies Base64 data length
  finalFrame.writeUInt16BE(base64Buffer.length, 0);

  // Write Base64-encoded frame data
  base64Buffer.copy(finalFrame, PROTOCOL_CONSTANTS.LENGTH_PREFIX_SIZE);

  return finalFrame;
}

/**
 * Decode a frame according to MiniTel-Lite protocol
 * @param {Buffer} frameData - Complete frame data including length prefix
 * @returns {Object} Decoded frame { cmd, nonce, payload, hash, isValid }
 */
function decodeFrame(frameData) {
  try {
    if (frameData.length < PROTOCOL_CONSTANTS.LENGTH_PREFIX_SIZE) {
      throw new Error(PROTOCOL_ERRORS.MALFORMED_FRAME);
    }

    // Read length prefix
    const dataLength = frameData.readUInt16BE(0);

    if (frameData.length < PROTOCOL_CONSTANTS.LENGTH_PREFIX_SIZE + dataLength) {
      throw new Error(PROTOCOL_ERRORS.MALFORMED_FRAME);
    }

    // Extract Base64 data
    const base64Data = frameData.subarray(PROTOCOL_CONSTANTS.LENGTH_PREFIX_SIZE, PROTOCOL_CONSTANTS.LENGTH_PREFIX_SIZE + dataLength);

    // Base64 decode
    let binaryFrame;
    try {
      binaryFrame = Buffer.from(base64Data.toString('ascii'), 'base64');
    } catch (error) {
      throw new Error(PROTOCOL_ERRORS.INVALID_BASE64);
    }

    // Minimum frame size check
    const minFrameSize = PROTOCOL_CONSTANTS.CMD_LENGTH + PROTOCOL_CONSTANTS.NONCE_LENGTH + PROTOCOL_CONSTANTS.HASH_LENGTH;
    if (binaryFrame.length < minFrameSize) {
      throw new Error(PROTOCOL_ERRORS.MALFORMED_FRAME);
    }

    let offset = 0;

    // Extract CMD
    const cmd = binaryFrame.readUInt8(offset);
    offset += PROTOCOL_CONSTANTS.CMD_LENGTH;

    // Extract NONCE
    const nonce = binaryFrame.readUInt32BE(offset);
    offset += PROTOCOL_CONSTANTS.NONCE_LENGTH;

    // Extract PAYLOAD (everything except the last 32 bytes which is the hash)
    const payloadLength = binaryFrame.length - minFrameSize;
    const payload = payloadLength > 0
      ? binaryFrame.subarray(offset, offset + payloadLength)
      : Buffer.alloc(0);
    offset += payloadLength;

    // Extract HASH
    const receivedHash = binaryFrame.subarray(offset);

    // Verify hash
    const calculatedHash = calculateHash(cmd, nonce, payload);
    const isValid = receivedHash.equals(calculatedHash);

    if (!isValid) {
      throw new Error(PROTOCOL_ERRORS.HASH_VALIDATION_FAILURE);
    }

    return {
      cmd,
      nonce,
      payload,
      hash: receivedHash,
      isValid,
      payloadString: payload.length > 0 ? payload.toString('utf8') : ''
    };
  } catch (error) {
    if (Object.values(PROTOCOL_ERRORS).includes(error.message)) {
      throw error;
    }
    throw new Error(PROTOCOL_ERRORS.MALFORMED_FRAME);
  }
}

/**
 * Extract frame length from incoming data
 * @param {Buffer} data - Incoming data buffer
 * @returns {number|null} Expected frame length or null if insufficient data
 */
function getExpectedFrameLength(data) {
  if (data.length < PROTOCOL_CONSTANTS.LENGTH_PREFIX_SIZE) {
    return null;
  }
  return PROTOCOL_CONSTANTS.LENGTH_PREFIX_SIZE + data.readUInt16BE(0);
}

module.exports = {
  encodeFrame,
  decodeFrame,
  getExpectedFrameLength,
  calculateHash
};
