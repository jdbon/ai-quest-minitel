# Testing Guide - MiniTel-Lite Client

## Table of Contents

1. [Test Architecture](#test-architecture)
2. [Running Tests](#running-tests)
3. [Test Categories](#test-categories)
4. [Edge Case Testing](#edge-case-testing)
5. [Test Data & Fixtures](#test-data--fixtures)
6. [Writing New Tests](#writing-new-tests)
7. [Continuous Integration](#continuous-integration)

## Test Architecture

The testing strategy employs multiple layers to ensure comprehensive coverage:

```text
┌─────────────────────────────────────────────────────────────┐
│                    Test Pyramid                            │
├─────────────────────────────────────────────────────────────┤
│         Integration Tests (tests/integration/)             │
│              • Complete application flows                  │
│              • End-to-end scenarios                       │
│              • Real-world edge cases                      │
├─────────────────────────────────────────────────────────────┤
│           Unit Tests (tests/unit/)                         │
│              • Individual component testing                │
│              • Function-level validation                   │
│              • Mock-based isolation                       │
└─────────────────────────────────────────────────────────────┘
```

### Test Infrastructure

- **Framework**: Jest with custom configuration
- **Mocking**: Custom network socket mocks for deterministic testing
- **Coverage**: LCOV reports with 80% minimum threshold
- **Fixtures**: Pre-defined test data for consistent scenarios

## Running Tests

### Quick Start

```bash
# Install dependencies
yarn install

# Run all tests
yarn test

# Run with coverage report
yarn test:coverage

# Run in watch mode (development)
yarn test:watch
```

### Test Suites

#### Unit Tests

```bash
yarn test:unit              # Run all unit tests
yarn test:unit --watch      # Watch mode
yarn test:unit --verbose    # Detailed output
```

#### Integration Tests

```bash
yarn test:integration       # Run integration tests
yarn test:integration --coverage  # With coverage
```

#### Custom Test Runner

```bash
# Use the custom test runner directly
node scripts/test-runner.js unit --verbose
node scripts/test-runner.js integration --coverage
node scripts/test-runner.js all --help
```

### Coverage Reports

```bash
# Generate coverage report
yarn test:coverage

# View HTML report
open coverage/lcov-report/index.html
```

**Coverage Requirements**:

- **Branches**: 80% minimum
- **Functions**: 80% minimum  
- **Lines**: 80% minimum
- **Statements**: 80% minimum

## Test Categories

### 1. Protocol Tests (`tests/unit/protocol/`)

#### Frame Encoding/Decoding (`frame.test.js`)

Tests the binary protocol implementation:

```javascript
describe('Protocol Frame Encoding/Decoding', () => {
  test('should encode HELLO command correctly', () => {
    const frame = encodeFrame(COMMANDS.HELLO, 0, '');
    expect(Buffer.isBuffer(frame)).toBe(true);
    // Verify frame structure...
  });
});
```

**Test Coverage**:

- ✅ Valid frame encoding/decoding
- ✅ Hash validation success/failure
- ✅ Malformed frame rejection  
- ✅ Oversized payload handling
- ✅ Unicode and binary payloads
- ✅ Edge cases (empty frames, boundary values)

#### Protocol Client (`client.test.js`)

Tests connection management and protocol flow:

```javascript
describe('MiniTel Protocol Client', () => {
  beforeEach(() => {
    // Setup mock socket
    mockSocket = new MockSocket({
      shouldConnect: true,
      mockResponses: [encodeFrame(RESPONSES.HELLO_ACK, 1, '')]
    });
  });
});
```

**Test Coverage**:

- ✅ Connection establishment/refusal
- ✅ Timeout handling
- ✅ HELLO/DUMP/STOP command flows
- ✅ Nonce sequence validation
- ✅ Unexpected disconnections
- ✅ Protocol error handling
- ✅ State management consistency

### 2. Application Tests (`tests/unit/client/`)

#### Error Handling (`tests/unit/utils/errors.test.js`)

Tests the comprehensive error handling system:

```javascript
describe('Error Handling Utilities', () => {
  test('should classify connection errors correctly', () => {
    const connError = new Error('ECONNREFUSED');
    const classified = ErrorHandler.classify(connError, 'connection');
    expect(classified instanceof ConnectionError).toBe(true);
  });
});
```

**Test Coverage**:

- ✅ Error classification by type
- ✅ Error context preservation
- ✅ Retry mechanism with backoff
- ✅ Validation utilities
- ✅ Global error handler setup

#### Session Recording (`tests/unit/recorder/session-recorder.test.js`)

Tests recording functionality:

```javascript
describe('Session Recorder', () => {
  test('should record interactions correctly', async () => {
    await recorder.startRecording('localhost', 8080);
    recorder.recordInteraction({
      type: 'request',
      command: 'HELLO',
      nonce: 0,
      payload: ''
    });
    const savedFile = await recorder.stopRecording();
    // Verify recording content...
  });
});
```

**Test Coverage**:

- ✅ Recording lifecycle (start/stop)
- ✅ Interaction data integrity
- ✅ File operations and error handling
- ✅ Export to multiple formats
- ✅ Auto-save and recovery

### 3. Integration Tests (`tests/integration/`)

#### Complete Application Flow (`application.test.js`)

Tests end-to-end scenarios:

```javascript
describe('MiniTel Application Integration', () => {
  test('should complete full HELLO + 2x DUMP sequence', async () => {
    const responses = [
      encodeFrame(RESPONSES.HELLO_ACK, 1, ''),
      encodeFrame(RESPONSES.DUMP_FAILED, 3, ''),
      encodeFrame(RESPONSES.DUMP_OK, 5, 'SECRET_CODE_12345')
    ];
    
    // Setup mock with complete response sequence
    jest.spyOn(require('net'), 'Socket').mockImplementation(() => {
      return new MockSocket({
        shouldConnect: true,
        mockResponses: responses
      });
    });
    
    await app.start();
    
    expect(console.log).toHaveBeenCalledWith('✅ Application completed successfully');
  });
});
```

## Edge Case Testing

### 1. Network Edge Cases

#### Connection Failures

```javascript
test('should handle connection refusal', async () => {
  jest.spyOn(require('net'), 'Socket').mockImplementation(() => {
    return new MockSocket({ shouldConnect: false });
  });
  
  await expect(app.start()).rejects.toThrow('Failed to connect');
});
```

#### Unexpected Disconnections

```javascript
test('should handle disconnection during DUMP sequence', async () => {
  const mock = new MockSocket({
    shouldConnect: true,
    shouldDisconnect: true,
    disconnectDelay: 100 // Disconnect after HELLO
  });
  
  await expect(app.start()).rejects.toThrow();
});
```

#### Partial Frame Reception

```javascript
test('should handle partial frame reception', async () => {
  const fullFrame = encodeFrame(RESPONSES.HELLO_ACK, 1, '');
  const part1 = fullFrame.subarray(0, fullFrame.length / 2);
  const part2 = fullFrame.subarray(fullFrame.length / 2);
  
  // Send frame in parts
  mockSocket.simulateData(part1);
  await testUtils.delay(10);
  mockSocket.simulateData(part2);
  
  const response = await responsePromise;
  expect(response.cmd).toBe(RESPONSES.HELLO_ACK);
});
```

### 2. Protocol Edge Cases

#### Invalid Nonce Sequences

```javascript
test('should reject response with invalid nonce', async () => {
  const wrongNonceResponse = encodeFrame(RESPONSES.HELLO_ACK, 999, '');
  
  const errorPromise = new Promise((resolve) => {
    client.on('error', resolve);
  });
  
  const error = await errorPromise;
  expect(error.message).toBe(PROTOCOL_ERRORS.INVALID_NONCE);
});
```

#### Hash Validation Failures

```javascript
test('should reject frame with invalid hash', () => {
  const corruptedFrame = generateCorruptedFrame({
    cmd: COMMANDS.HELLO,
    nonce: 0,
    payload: ''
  });
  
  expect(() => {
    decodeFrame(corruptedFrame);
  }).toThrow(PROTOCOL_ERRORS.HASH_VALIDATION_FAILURE);
});
```

#### Malformed Data

```javascript
const MALFORMED_DATA = {
  INVALID_BASE64: Buffer.from([0x00, 0x02, 0xFF, 0xFE]),
  TRUNCATED_FRAME: Buffer.from([0x00, 0x04, 0x41, 0x42]),
  EMPTY_FRAME: Buffer.from([0x00, 0x00])
};

test('should reject malformed frames', () => {
  Object.entries(MALFORMED_DATA).forEach(([name, data]) => {
    expect(() => decodeFrame(data)).toThrow();
  });
});
```

### 3. Resource Edge Cases

#### File System Errors

```javascript
test('should handle file system errors gracefully', async () => {
  const invalidRecorder = new SessionRecorder({
    enabled: true,
    recordingsDir: '/invalid/path/that/does/not/exist'
  });
  
  await expect(invalidRecorder.startRecording('localhost', 8080))
    .rejects.toThrow('Failed to create recordings directory');
});
```

#### Memory Pressure

```javascript
test('should handle maximum payload size', () => {
  const maxPayload = 'x'.repeat(65535);
  const frame = encodeFrame(COMMANDS.DUMP, 0, maxPayload);
  const decoded = decodeFrame(frame);
  
  expect(decoded.payloadString).toBe(maxPayload);
});

test('should reject oversized payload', () => {
  const oversizedPayload = 'x'.repeat(65536);
  
  expect(() => {
    encodeFrame(COMMANDS.HELLO, 0, oversizedPayload);
  }).toThrow('Payload size exceeds maximum');
});
```

### 4. Reconnection Edge Cases

#### Successful Recovery

```javascript
test('should succeed after reconnection', async () => {
  let connectionAttempts = 0;
  
  jest.spyOn(require('net'), 'Socket').mockImplementation(() => {
    connectionAttempts++;
    
    if (connectionAttempts === 1) {
      return new MockSocket({ shouldConnect: false });
    } else {
      return new MockSocket({
        shouldConnect: true,
        mockResponses: [/* successful responses */]
      });
    }
  });
  
  await app.start();
  expect(connectionAttempts).toBe(2);
});
```

## Test Data & Fixtures

### Protocol Fixtures (`tests/fixtures/protocol-fixtures.js`)

Provides consistent test data:

```javascript
const VALID_FRAMES = {
  HELLO_REQUEST: {
    cmd: COMMANDS.HELLO,
    nonce: 0,
    payload: '',
    expectedResponse: RESPONSES.HELLO_ACK
  }
};

const CONNECTION_SCENARIOS = {
  SUCCESSFUL_HELLO: {
    description: 'Successful HELLO handshake',
    clientSends: VALID_FRAMES.HELLO_REQUEST,
    serverResponds: VALID_RESPONSES.HELLO_ACK,
    expectedState: { isConnected: true, currentNonce: 2 }
  }
};
```

### Mock Network Socket (`tests/mocks/net-mock.js`)

Deterministic network behavior simulation:

```javascript
class MockSocket extends EventEmitter {
  constructor(options = {}) {
    this.mockOptions = {
      shouldConnect: options.shouldConnect !== false,
      connectDelay: options.connectDelay || 0,
      shouldDisconnect: options.shouldDisconnect || false,
      mockResponses: options.mockResponses || []
    };
  }

  // Simulate various network conditions
  simulateData(data) { /* ... */ }
  simulateError(error) { /* ... */ }
  simulateDisconnect() { /* ... */ }
}
```

## Writing New Tests

### Test Structure Template

```javascript
/**
 * Tests for [Component Name]
 * [Brief description of what is being tested]
 */

const ComponentToTest = require('../../src/path/to/component');

describe('[Component Name]', () => {
  let componentInstance;

  beforeEach(() => {
    // Setup test environment
    componentInstance = new ComponentToTest();
  });

  afterEach(() => {
    // Cleanup resources
    if (componentInstance.cleanup) {
      componentInstance.cleanup();
    }
  });

  describe('[Feature Category]', () => {
    test('should [expected behavior]', async () => {
      // Arrange
      const testData = { /* test input */ };
      
      // Act
      const result = await componentInstance.methodUnderTest(testData);
      
      // Assert
      expect(result).toEqual(expectedResult);
    });

    test('should handle [error condition]', async () => {
      // Test error scenarios
      await expect(componentInstance.methodUnderTest(invalidData))
        .rejects.toThrow('Expected error message');
    });
  });
});
```

### Best Practices

1. **Descriptive Test Names**: Use "should [expected behavior] when [condition]"
2. **Arrange-Act-Assert**: Clear test structure
3. **Mock External Dependencies**: Use mocks for network, file system
4. **Test Edge Cases**: Boundary values, error conditions
5. **Clean Teardown**: Properly cleanup resources
6. **Async Testing**: Use proper async/await patterns

### Mock Guidelines

```javascript
// Good: Specific, deterministic mock
const mockSocket = new MockSocket({
  shouldConnect: true,
  mockResponses: [
    encodeFrame(RESPONSES.HELLO_ACK, 1, '')
  ]
});

// Good: Error scenario mock
const mockFailingSocket = new MockSocket({
  shouldConnect: false,
  connectionError: { code: 'ECONNREFUSED' }
});
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [16, 18, 20]
    
    steps:
    - uses: actions/checkout@v3
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm run test:coverage
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
```

### Quality Gates

Tests must pass these criteria:

- ✅ All test suites pass
- ✅ Coverage thresholds met (80%)
- ✅ No linting errors
- ✅ Performance benchmarks within limits

### Pre-commit Hooks

```bash
# Install pre-commit hooks
yarn dlx husky install

# Add test hook
yarn dlx husky add .husky/pre-commit "yarn test:unit"
```

This comprehensive testing approach ensures the MiniTel-Lite client is robust,
reliable, and handles all edge cases gracefully.
