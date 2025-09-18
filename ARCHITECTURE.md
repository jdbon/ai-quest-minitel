# MiniTel-Lite Client - Architecture & Design

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Design Decisions](#design-decisions)
3. [Component Details](#component-details)
4. [Edge Case Handling](#edge-case-handling)
5. [Testing Strategy](#testing-strategy)
6. [Performance Considerations](#performance-considerations)

## Architecture Overview

The MiniTel-Lite client follows a **layered architecture** with clear separation
of concerns, enabling maintainability, testability, and extensibility.

```text
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
├─────────────────────────────────────────────────────────────┤
│  CLI Interface (index.js)     │  TUI Interactive + Replay   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                         │
├─────────────────────────────────────────────────────────────┤
│             Application Orchestrator                        │
│        (client/application.js)                              │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                            │
├─────────────────────────────────────────────────────────────┤
│ Protocol Client  │ Session Recorder │  TUI Player           │
│ (protocol/)      │ (recorder/)      │  (replay/)            │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                       │
├─────────────────────────────────────────────────────────────┤
│    Utilities (utils/)      │    Configuration               │
│  • Error Handling         │  • Logging                     │
│  • Validation             │  • Config Management           │
└─────────────────────────────────────────────────────────────┘
```

### Core Principles

1. **Single Responsibility**: Each component has one clear purpose
2. **Dependency Inversion**: High-level modules don't depend on low-level modules
3. **Event-Driven Design**: Loose coupling through event emission
4. **Fail-Fast**: Early validation and error detection
5. **Graceful Degradation**: Continue operation when possible

## Design Decisions

### 1. Protocol Implementation Strategy

**Decision**: Separate protocol concerns into distinct modules

- `constants.js` - Protocol definitions
- `frame.js` - Binary frame encoding/decoding
- `client.js` - Connection and state management

**Rationale**:

- **Testability**: Each component can be unit tested independently
- **Maintainability**: Protocol changes isolated to specific modules
- **Reusability**: Frame encoding can be used independently
- **Clarity**: Clear separation between wire format and business logic

### 2. Event-Driven Architecture

**Decision**: Use EventEmitter pattern for client-server communication

```javascript
// Protocol client emits events for state changes
client.on('connected', () => { /* handle connection */ });
client.on('frameTransmitted', (frame) => { /* record interaction */ });
client.on('disconnected', () => { /* handle disconnection */ });
```

**Rationale**:

- **Loose Coupling**: Application doesn't directly depend on network events
- **Extensibility**: New event handlers can be added without modifying core logic
- **Session Recording**: Natural integration point for recording system
- **Error Handling**: Centralized error propagation

### 3. State Management Approach

**Decision**: Centralized state in protocol client with immutable getters

```javascript
getState() {
  return {
    isConnected: this.isConnected,
    currentNonce: this.currentNonce,
    lastCommand: this.lastCommand,
    dumpCounter: this.dumpCounter
  };
}
```

**Rationale**:

- **Predictability**: Single source of truth for connection state
- **Debugging**: Easy to inspect current state
- **Thread Safety**: Immutable state snapshots
- **Testing**: Deterministic state verification

### 4. Error Classification System

**Decision**: Hierarchical error types with contextual information

```javascript
class MiniTelError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}
```

**Rationale**:

- **Structured Handling**: Different error types handled appropriately
- **Debugging**: Rich context for error investigation
- **User Experience**: Meaningful error messages
- **Monitoring**: Error categorization for operations

### 5. Session Recording Design

**Decision**: JSON-based recording with auto-save and export capabilities

**Rationale**:

- **Human Readable**: JSON format is easily inspectable
- **Crash Recovery**: Auto-save prevents data loss
- **Flexibility**: Multiple export formats (JSON, CSV, TXT)
- **Compatibility**: Standard format for tooling integration

### 6. Configuration Strategy

**Decision**: Layered configuration with environment variables, CLI args, and defaults

```javascript
// Priority: CLI args > Environment > Defaults  
const host = args.host || process.env.SERVER_HOST || 'localhost';
```

**Rationale**:

- **Development Workflow**: Easy local overrides
- **Production Deployment**: Environment-based configuration
- **User Experience**: Sensible defaults for immediate use

## Component Details

### Presentation Layer

#### CLI Interface (`src/index.js`)

**Responsibilities**:

- Command-line argument parsing and validation
- Configuration display and environment setup  
- Application mode selection (automatic vs interactive)
- Graceful shutdown and error handling

#### Interactive TUI (`src/client/interactive-tui.js`)

**Responsibilities**:

- Real-time user interface for manual protocol control
- Connection status and session state display
- Protocol command validation and error feedback  
- Interactive help system and keyboard controls

**Key Features**:

- **Real-time Status**: Live connection state, nonce tracking, command history
- **Manual Control**: Send HELLO, DUMP, and STOP commands on demand
- **Protocol Validation**: Enforces HELLO-first requirement, provides feedback
- **Rich UI**: Activity log, help system, keyboard navigation
- **Error Handling**: User-friendly error display and recovery guidance

#### Session Replay TUI (`src/replay/tui-player.js`)

**Responsibilities**:

- Interactive playback of recorded sessions
- Step-by-step navigation and auto-play functionality
- Session metadata and interaction details display

### Protocol Layer (`src/protocol/`)

#### Frame Encoder/Decoder (`frame.js`)

Handles binary frame structure according to MiniTel-Lite v3.0 specification:

```text
LEN (2 bytes, big-endian) | DATA_B64 (LEN bytes, Base64 encoded)

Binary Frame (after Base64 decoding):
CMD (1 byte) | NONCE (4 bytes, big-endian) | PAYLOAD (0-65535 bytes) | HASH (32 bytes)
```

**Key Features**:

- SHA-256 hash validation for integrity
- Streaming frame processing for partial data
- Payload size validation (0-65535 bytes)
- Unicode and binary payload support

#### Protocol Client (`client.js`)

Manages TCP connection and implements protocol state machine:

**State Machine**:

```text
[Disconnected] --connect()--> [Connecting] --success--> [Connected]
[Connected] --sendHello()--> [Authenticated]
[Authenticated] --sendDump()--> [Operating]
[Operating] --sendStop()--> [Terminating] --> [Disconnected]
```

**Critical Sections** (heavily commented in code):

- Nonce sequence validation
- Frame buffer management
- Connection timeout handling
- Graceful disconnection

### Application Layer (`src/client/`)

#### Application Orchestrator (`application.js`)

Coordinates the complete protocol flow:

1. **Initialization Phase**
   - Setup client and recorder
   - Establish connection with retry logic

2. **Protocol Execution Phase**
   - HELLO handshake
   - Two DUMP command sequence
   - Result aggregation

3. **Cleanup Phase**
   - Graceful STOP command
   - Resource cleanup
   - Session recording finalization

### Service Layer

#### Session Recorder (`src/recorder/`)

**Design Goals**:

- Zero-overhead when disabled
- Crash-resistant (auto-save)
- Multiple export formats
- Efficient storage

**File Format**:

```json
{
  "metadata": {
    "sessionId": "session_2023-09-17T10-30-15-456Z_ef789012",
    "startTime": "2023-09-17T10:30:15.456Z",
    "endTime": "2023-09-17T10:30:18.789Z",
    "totalSteps": 6,
    "serverHost": "configured.server.com",
    "serverPort": 8080
  },
  "interactions": [...]
}
```

#### TUI Player (`src/replay/`)

Terminal-based replay system using blessed.js:

- Real-time step navigation
- Auto-play with configurable timing
- Rich interaction display
- Keyboard-driven interface

## Edge Case Handling

### 1. Network Disconnections

**Scenario**: Server unexpectedly closes connection
**Handling**:

```javascript
// Auto-reconnection with exponential backoff
async _connectWithRetry() {
  for (let attempt = 1; attempt <= this.maxReconnectAttempts; attempt++) {
    try {
      await this.client.connect();
      return;
    } catch (error) {
      if (attempt === this.maxReconnectAttempts) throw error;
      
      const delay = this.reconnectDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### 2. Protocol Violations

**Scenario**: Invalid nonce sequence from server
**Handling**:

```javascript
// Immediate disconnection on protocol violation
if (decodedFrame.nonce !== this.currentNonce - 1) {
  this.emit('error', new Error(PROTOCOL_ERRORS.INVALID_NONCE));
  this.disconnect();
  return;
}
```

### 3. Partial Frame Reception

**Scenario**: TCP frame arrives in multiple chunks
**Handling**:

```javascript
_handleIncomingData(data) {
  this.incomingBuffer = Buffer.concat([this.incomingBuffer, data]);
  
  // Process all complete frames
  while (this.incomingBuffer.length >= PROTOCOL_CONSTANTS.LENGTH_PREFIX_SIZE) {
    const expectedLength = getExpectedFrameLength(this.incomingBuffer);
    if (expectedLength === null || this.incomingBuffer.length < expectedLength) {
      break; // Wait for more data
    }
    
    // Process complete frame and continue
    // ...
  }
}
```

### 4. Hash Validation Failures

**Scenario**: Corrupted frame or malicious data
**Handling**:

```javascript
// Cryptographic integrity check
const calculatedHash = calculateHash(cmd, nonce, payload);
if (!receivedHash.equals(calculatedHash)) {
  throw new Error(PROTOCOL_ERRORS.HASH_VALIDATION_FAILURE);
}
```

### 5. Resource Exhaustion

**Scenario**: Large payloads or memory pressure
**Handling**:

```javascript
// Strict payload size limits
if (payloadBuffer.length > PROTOCOL_CONSTANTS.MAX_PAYLOAD_SIZE) {
  throw new Error(`Payload size exceeds maximum: ${payloadBuffer.length}`);
}
```

### 6. File System Errors

**Scenario**: Disk full during recording
**Handling**:

```javascript
async _saveSession() {
  try {
    await fs.writeFile(this.sessionFile, JSON.stringify(sessionData, null, 2));
  } catch (error) {
    // Log error but don't crash application
    console.error('⚠️  Failed to save session:', error.message);
    throw new RecordingError(`Failed to save session: ${error.message}`);
  }
}
```

### 7. Configuration Validation

**Scenario**: Invalid configuration parameters
**Handling**:

```javascript
function validateConfig(config) {
  // Port validation with clear error messages
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new ConfigurationError('Invalid port specified (must be 1-65535)');
  }
  
  // Timeout validation
  if (!Number.isInteger(config.timeout) || config.timeout < 100) {
    throw new ConfigurationError('Invalid timeout specified (minimum 100ms)');
  }
}
```

## Testing Strategy

### 1. Unit Tests

- **Protocol Frame Encoding/Decoding**: Binary format correctness
- **Error Handling**: All error paths and edge cases
- **State Management**: State transitions and consistency
- **Validation**: Input validation and boundary conditions

### 2. Integration Tests

- **Complete Protocol Flow**: Full HELLO + DUMP + STOP sequence
- **Disconnection Scenarios**: Unexpected disconnections at various points
- **Reconnection Logic**: Auto-reconnect with various failure modes
- **Session Recording**: End-to-end recording and playback

### 3. Mock Strategy

Custom network socket mock for deterministic testing:

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
}
```

### 4. Test Fixtures

Predefined protocol frames and scenarios:

```javascript
const VALID_FRAMES = {
  HELLO_REQUEST: {
    cmd: COMMANDS.HELLO,
    nonce: 0,
    payload: '',
    expectedResponse: RESPONSES.HELLO_ACK
  }
};
```

## Performance Considerations

### 1. Memory Management

- **Streaming Frame Processing**: Process frames as they arrive
- **Buffer Reuse**: Minimize memory allocations
- **Auto-cleanup**: Clear buffers after processing

### 2. Connection Efficiency

- **Keep-Alive**: Maintain connections when possible
- **Timeout Management**: Appropriate timeouts for different operations
- **Resource Cleanup**: Proper cleanup on disconnection

### 3. I/O Optimization

- **Asynchronous Operations**: Non-blocking file and network operations
- **Batch Recording**: Auto-save with reasonable frequency
- **Lazy Loading**: Load recordings only when needed

### 4. Error Recovery

- **Circuit Breaker Pattern**: Prevent cascade failures
- **Exponential Backoff**: Reduce server load during reconnection
- **Graceful Degradation**: Continue operation with reduced functionality

This architecture provides a robust, maintainable, and extensible foundation
for the MiniTel-Lite client while handling edge cases gracefully and providing
comprehensive testing coverage.
