/**
 * Tests for Protocol Frame Encoding/Decoding
 * Verifies binary frame structure, Base64 encoding, and hash validation
 */

const { encodeFrame, decodeFrame, getExpectedFrameLength, calculateHash } = require('../../../src/protocol/frame');
const { COMMANDS, RESPONSES, PROTOCOL_ERRORS } = require('../../../src/protocol/constants');
const { MALFORMED_DATA } = require('../../fixtures/protocol-fixtures');

describe('Protocol Frame Encoding/Decoding', () => {
  describe('encodeFrame', () => {
    test('should encode HELLO command correctly', () => {
      const frame = encodeFrame(COMMANDS.HELLO, 0, '');

      expect(Buffer.isBuffer(frame)).toBe(true);
      expect(frame.length).toBeGreaterThan(2); // At least length prefix

      // Check length prefix (first 2 bytes, big-endian)
      const dataLength = frame.readUInt16BE(0);
      expect(frame.length).toBe(2 + dataLength);
    });

    test('should encode DUMP command with payload', () => {
      const payload = 'test payload';
      const frame = encodeFrame(COMMANDS.DUMP, 2, payload);

      expect(Buffer.isBuffer(frame)).toBe(true);

      // Decode to verify payload
      const decoded = decodeFrame(frame);
      expect(decoded.cmd).toBe(COMMANDS.DUMP);
      expect(decoded.nonce).toBe(2);
      expect(decoded.payloadString).toBe(payload);
    });

    test('should handle empty payload', () => {
      const frame = encodeFrame(COMMANDS.HELLO, 0, '');
      const decoded = decodeFrame(frame);

      expect(decoded.payloadString).toBe('');
      expect(decoded.payload.length).toBe(0);
    });

    test('should handle maximum practical payload size', () => {
      // Calculate max payload that fits within Base64 encoded frame limit
      // Max Base64 frame: 65535, so max binary: ~49151, minus headers: ~49114
      const maxPayload = 'x'.repeat(49100); // Use slightly smaller for safety
      const frame = encodeFrame(COMMANDS.DUMP, 0, maxPayload);
      const decoded = decodeFrame(frame);

      expect(decoded.payloadString).toBe(maxPayload);
    });

    test('should throw error for oversized payload', () => {
      const oversizedPayload = 'x'.repeat(65536);

      expect(() => {
        encodeFrame(COMMANDS.HELLO, 0, oversizedPayload);
      }).toThrow('Payload size exceeds maximum');
    });

    test('should handle Buffer payloads', () => {
      const payloadBuffer = Buffer.from('binary data', 'utf8');
      const frame = encodeFrame(COMMANDS.DUMP, 0, payloadBuffer);
      const decoded = decodeFrame(frame);

      expect(decoded.payload.equals(payloadBuffer)).toBe(true);
    });
  });

  describe('decodeFrame', () => {
    test('should decode valid HELLO frame', () => {
      const frame = encodeFrame(COMMANDS.HELLO, 0, '');
      const decoded = decodeFrame(frame);

      expect(decoded.cmd).toBe(COMMANDS.HELLO);
      expect(decoded.nonce).toBe(0);
      expect(decoded.payloadString).toBe('');
      expect(decoded.isValid).toBe(true);
    });

    test('should decode valid DUMP response with payload', () => {
      const payload = 'SECRET_CODE_12345';
      const frame = encodeFrame(RESPONSES.DUMP_OK, 3, payload);
      const decoded = decodeFrame(frame);

      expect(decoded.cmd).toBe(RESPONSES.DUMP_OK);
      expect(decoded.nonce).toBe(3);
      expect(decoded.payloadString).toBe(payload);
      expect(decoded.isValid).toBe(true);
    });

    test('should reject frame with invalid hash', () => {
      const validFrame = encodeFrame(COMMANDS.HELLO, 0, '');

      // Create corrupted frame by manually corrupting the binary data before Base64 encoding
      const base64Data = validFrame.subarray(2);
      const binaryFrame = Buffer.from(base64Data.toString(), 'base64');

      // Corrupt the last byte of the hash (last 32 bytes of binary frame)
      binaryFrame[binaryFrame.length - 1] ^= 0xFF;

      // Re-encode to Base64 and create new frame with correct length prefix
      const corruptedBase64 = Buffer.from(binaryFrame.toString('base64'));
      const newLengthPrefix = Buffer.alloc(2);
      newLengthPrefix.writeUInt16BE(corruptedBase64.length, 0);
      const corruptedFrame = Buffer.concat([newLengthPrefix, corruptedBase64]);

      expect(() => {
        decodeFrame(corruptedFrame);
      }).toThrow(PROTOCOL_ERRORS.HASH_VALIDATION_FAILURE);
    });

    test('should reject malformed frame - too short', () => {
      const shortFrame = Buffer.from([0x00, 0x01, 0x41]); // Says 1 byte but frame too short

      expect(() => {
        decodeFrame(shortFrame);
      }).toThrow(PROTOCOL_ERRORS.MALFORMED_FRAME);
    });

    test('should reject frame with invalid Base64', () => {
      // Note: Node.js Base64 decoder is very lenient and rarely throws errors
      // Invalid Base64 typically results in empty/small buffers that fail minimum size check
      expect(() => {
        decodeFrame(MALFORMED_DATA.INVALID_BASE64);
      }).toThrow(PROTOCOL_ERRORS.MALFORMED_FRAME);
    });

    test('should reject truncated frame', () => {
      expect(() => {
        decodeFrame(MALFORMED_DATA.TRUNCATED_FRAME);
      }).toThrow(PROTOCOL_ERRORS.MALFORMED_FRAME);
    });

    test('should reject empty frame', () => {
      expect(() => {
        decodeFrame(MALFORMED_DATA.EMPTY_FRAME);
      }).toThrow(PROTOCOL_ERRORS.MALFORMED_FRAME);
    });

    test('should handle frame with no length prefix', () => {
      const noLengthFrame = Buffer.from([0x41]); // Just data, no length prefix

      expect(() => {
        decodeFrame(noLengthFrame);
      }).toThrow(PROTOCOL_ERRORS.MALFORMED_FRAME);
    });
  });

  describe('getExpectedFrameLength', () => {
    test('should return correct frame length', () => {
      const frame = encodeFrame(COMMANDS.HELLO, 0, 'test');
      const expectedLength = getExpectedFrameLength(frame);

      expect(expectedLength).toBe(frame.length);
    });

    test('should return null for insufficient data', () => {
      const shortBuffer = Buffer.from([0x00]); // Only 1 byte, need 2 for length
      const expectedLength = getExpectedFrameLength(shortBuffer);

      expect(expectedLength).toBeNull();
    });

    test('should handle zero-length data', () => {
      const zeroLengthFrame = Buffer.from([0x00, 0x00]); // Length = 0
      const expectedLength = getExpectedFrameLength(zeroLengthFrame);

      expect(expectedLength).toBe(2); // Just the length prefix
    });
  });

  describe('calculateHash', () => {
    test('should produce consistent hash for same input', () => {
      const hash1 = calculateHash(COMMANDS.HELLO, 0, Buffer.from(''));
      const hash2 = calculateHash(COMMANDS.HELLO, 0, Buffer.from(''));

      expect(hash1.equals(hash2)).toBe(true);
      expect(hash1.length).toBe(32); // SHA-256 produces 32-byte hash
    });

    test('should produce different hash for different input', () => {
      const hash1 = calculateHash(COMMANDS.HELLO, 0, Buffer.from(''));
      const hash2 = calculateHash(COMMANDS.HELLO, 1, Buffer.from(''));

      expect(hash1.equals(hash2)).toBe(false);
    });

    test('should handle different payload sizes', () => {
      const emptyHash = calculateHash(COMMANDS.HELLO, 0, Buffer.from(''));
      const payloadHash = calculateHash(COMMANDS.HELLO, 0, Buffer.from('payload'));

      expect(emptyHash.equals(payloadHash)).toBe(false);
      expect(emptyHash.length).toBe(32);
      expect(payloadHash.length).toBe(32);
    });
  });

  describe('Round-trip encoding/decoding', () => {
    test('should preserve all frame components', () => {
      const originalCmd = COMMANDS.DUMP;
      const originalNonce = 42;
      const originalPayload = 'Test payload with special chars: åäö 123!@#';

      const encoded = encodeFrame(originalCmd, originalNonce, originalPayload);
      const decoded = decodeFrame(encoded);

      expect(decoded.cmd).toBe(originalCmd);
      expect(decoded.nonce).toBe(originalNonce);
      expect(decoded.payloadString).toBe(originalPayload);
      expect(decoded.isValid).toBe(true);
    });

    test('should handle Unicode payloads correctly', () => {
      const unicodePayload = '🚀 Unicode test: 中文 Ελληνικά العربية';

      const encoded = encodeFrame(COMMANDS.DUMP, 0, unicodePayload);
      const decoded = decodeFrame(encoded);

      expect(decoded.payloadString).toBe(unicodePayload);
      expect(decoded.isValid).toBe(true);
    });

    test('should handle binary payload data', () => {
      const binaryPayload = Buffer.from([0x00, 0x01, 0xFF, 0xFE, 0x7F]);

      const encoded = encodeFrame(COMMANDS.DUMP, 0, binaryPayload);
      const decoded = decodeFrame(encoded);

      expect(decoded.payload.equals(binaryPayload)).toBe(true);
      expect(decoded.isValid).toBe(true);
    });
  });

  describe('Edge cases and error conditions', () => {
    test('should handle maximum nonce value', () => {
      const maxNonce = 0xFFFFFFFF; // Maximum 32-bit unsigned integer

      const encoded = encodeFrame(COMMANDS.HELLO, maxNonce, '');
      const decoded = decodeFrame(encoded);

      expect(decoded.nonce).toBe(maxNonce);
      expect(decoded.isValid).toBe(true);
    });

    test('should handle all command types', () => {
      const commands = [COMMANDS.HELLO, COMMANDS.DUMP, COMMANDS.STOP_CMD];

      commands.forEach(cmd => {
        const encoded = encodeFrame(cmd, 0, '');
        const decoded = decodeFrame(encoded);

        expect(decoded.cmd).toBe(cmd);
        expect(decoded.isValid).toBe(true);
      });
    });

    test('should handle all response types', () => {
      const responses = [RESPONSES.HELLO_ACK, RESPONSES.DUMP_OK, RESPONSES.DUMP_FAILED, RESPONSES.STOP_OK];

      responses.forEach(resp => {
        const encoded = encodeFrame(resp, 1, '');
        const decoded = decodeFrame(encoded);

        expect(decoded.cmd).toBe(resp);
        expect(decoded.isValid).toBe(true);
      });
    });
  });
});
