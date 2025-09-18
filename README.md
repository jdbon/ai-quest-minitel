# MiniTel-Lite Protocol Client

A comprehensive Node.js implementation of the MiniTel-Lite Protocol v3.0 with
TUI (Text User Interface) support and session recording capabilities.

## Features

- ✅ **Full MiniTel-Lite Protocol v3.0 Support**
  - TCP-based binary frame protocol
  - SHA-256 hash validation
  - Base64 encoding/decoding
  - Nonce sequence tracking
  - Automatic connection timeout handling

- 🎮 **Interactive & Automatic Modes**
  - **Interactive Mode**: Manual TUI control over protocol commands
  - **Automatic Mode**: Predefined sequence execution (HELLO + 2x DUMP)
  - Real-time connection status and command feedback
  - User-controlled protocol flow

- 🎬 **Session Recording**
  - Record all client-server interactions
  - JSON format with timestamps
  - Uniquely identifiable recording files
  - Export to CSV and text formats

- 🖥️ **Terminal User Interface (TUI)**
  - Interactive protocol command control
  - Real-time session replay of recorded sessions
  - Step-by-step navigation and auto-play mode
  - Rich visual feedback and help system

- 🛡️ **Robust Error Handling**
  - Graceful disconnection handling
  - Automatic reconnection attempts
  - Comprehensive logging system
  - Protocol violation detection

- 🏗️ **Clean Architecture**
  - Modular design with separation of concerns
  - Industry best practices
  - Comprehensive error classification
  - Configurable via command-line arguments

## Installation

```bash
# Clone or extract the project
cd minitel-client

# Use the correct Node.js version (if using nvm)
nvm use

# Install dependencies (also runs setup automatically)
yarn install

# Make scripts executable (Unix/macOS)  
chmod +x src/index.js src/replay.js

# Manual setup (if needed)
yarn setup
```

**Note:** The `yarn setup` command runs automatically after `yarn install`
via the `postinstall` script. It handles:

- Creating necessary directories (`logs/`, `recordings/`)
- Verifying file permissions
- Initial project configuration

### Node.js Version

This project uses Node.js 18 (LTS). If you're using [nvm](https://github.com/nvm-sh/nvm),
the `.nvmrc` file will automatically set the correct version:

```bash
# Install and use the specified Node.js version
nvm install
nvm use
```

### Environment Configuration

**🔐 IMPORTANT: Never commit server credentials to version control!**

1. **Copy the environment template for local development:**

```bash
cp env.example .env.local
```

1. **Edit `.env.local` with your actual server credentials:**

```bash
# Update these values with your actual server information
SERVER_HOST=your.server.hostname.com
SERVER_PORT=XXXX

# Optional: Customize other settings for development
LOG_LEVEL=debug
CONNECTION_TIMEOUT=5000
MAX_RECONNECT_ATTEMPTS=3
RECORDINGS_DIR=./recordings
NODE_ENV=development
```

1. **The `.env.local` file is automatically gitignored** for security.

**💡 Why `.env.local`?**

- `.env.local` is the standard for local development overrides
- Automatically gitignored to prevent credential leaks
- Takes precedence over `.env` (if present)
- Follows industry best practices (Next.js, Create React App, etc.)

**Environment Variables Reference:**

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `SERVER_HOST` | MiniTel server hostname | `localhost` | `server.com` |
| `SERVER_PORT` | MiniTel server port | `8080` | `8080` |
| `LOG_LEVEL` | Logging detail level | `info` | `debug`, `warn`, `error` |
| `CONNECTION_TIMEOUT` | Connection timeout (ms) | `2000` | `5000` |
| `MAX_RECONNECT_ATTEMPTS` | Auto-reconnect attempts | `3` | `5` |
| `RECONNECT_DELAY` | Delay between reconnects (ms) | `1000` | `2000` |
| `RECORDINGS_DIR` | Session recordings directory | `./recordings` | `/var/log` |
| `NODE_ENV` | Environment mode | `development` | `production` |

## Quick Start

### Basic Usage

#### Automatic Mode (Default)

Execute the predefined protocol sequence automatically (HELLO + 2x DUMP):

```bash
# Basic connection (uses configured server via environment variables)
yarn start

# Enable session recording with default server  
yarn start --record
# or use the convenience script:
yarn start:record

# Connect to a different server
yarn start --host localhost --port 8080

# Full example with all options
yarn start --host localhost --port 8080 --record --log-level debug --timeout 5000
```

#### Interactive Mode ✨

Take manual control of the protocol with an intuitive TUI interface:

```bash
# Quick interactive mode (convenience scripts)
yarn interactive                    # Basic interactive mode
yarn start:interactive             # Same as above
yarn start:interactive:record      # Interactive mode with recording

# Full control with flags
yarn start --interactive --host localhost --port 8080
yarn start --interactive --record --log-level debug
```

**Interactive TUI Controls:**

- **[H]** - Send HELLO command (required first)
- **[D]** - Send DUMP command (requires HELLO first)
- **[S]** - Send STOP command (graceful disconnect)
- **[Q]** - Quit application
- **[?]** - Show detailed help

**Server Configuration:**

- **Primary**: Environment variables (`SERVER_HOST`, `SERVER_PORT`)
- **Fallback**: `localhost:8080` (development defaults)
- **Override**: Command-line arguments (`--host`, `--port`)

Copy `.env.example` to `.env` and configure your server details securely.

### Session Recording

Enable recording to capture all interactions:

```bash
# Start with recording enabled
yarn start --record

# Specify custom recordings directory
yarn start --record --recordings-dir ./my-sessions
```

Recording files are saved with timestamps and unique IDs:

```text
recordings/session_2023-09-17T10-30-00-123Z_abcd1234.json
```

### Session Replay

#### Finding Your Recordings

First, discover what recordings are available:

```bash
# List all recorded sessions with details
yarn list-recordings
```

This shows session metadata like duration, steps, server info, and file sizes.

#### Replaying Sessions

Use the TUI replay application to view recorded sessions:

```bash
# Replay a specific session
yarn replay session_2025-09-18T03-41-44-357Z_5edf9a7a.json

# Auto-play mode with default 1-second delay
yarn replay session_2025-09-18T03-41-44-357Z_5edf9a7a.json --auto-play

# Auto-play with custom delay (2 seconds between steps)  
yarn replay session_2025-09-18T03-41-44-357Z_5edf9a7a.json \
  --auto-play --auto-play-delay 2000

# Use custom recordings directory
yarn replay recording.json --recordings-dir /path/to/recordings
```

#### TUI Controls

- **N/n, →, Space**: Next step
- **P/p, ←**: Previous step  
- **A**: Toggle auto-play
- **Home/1**: Jump to first step
- **End/0**: Jump to last step
- **H/?**: Show help
- **Q**: Quit

#### Recording Management

Clean up and export your recorded sessions:

```bash
# Delete recordings older than 30 days (default)
yarn cleanup-recordings

# Delete recordings older than 7 days
yarn cleanup-recordings 7

# Export recording to CSV format
yarn export-recording session_2025-09-18T03-41-44-357Z_5edf9a7a.json csv

# Export recording to text format
yarn export-recording session_2025-09-18T03-41-44-357Z_5edf9a7a.json txt
```

#### Complete Recording Workflow

1. **Record a session:**

   ```bash
   yarn start:record                    # Automatic mode with recording
   yarn start:interactive:record        # Interactive mode with recording
   ```

2. **Find your recordings:**

   ```bash
   yarn list-recordings                 # Shows all available sessions
   ```

3. **Replay a session:**

   ```bash
   yarn replay <session-filename.json>  # Interactive step-by-step replay
   ```

4. **Manage recordings:**

   ```bash
   yarn cleanup-recordings              # Clean up old files
   yarn export-recording <file> <format> # Export to CSV/text
   ```

## Configuration

### Environment Variables

You can set default server configuration using environment variables:

```bash
# Set custom server defaults
export SERVER_HOST=localhost
export SERVER_PORT=8080

# Set other configuration defaults
export LOG_LEVEL=debug
export CONNECTION_TIMEOUT=5000
export MAX_RECONNECT_ATTEMPTS=5

# Run with environment defaults
yarn start
```

See `config/server.config.js` for all available configuration options.

## Command Line Options

### Main Client (`yarn start`)

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--host` | `-h` | Server hostname | `$SERVER_HOST` or `localhost` |
| `--port` | `-p` | Server port number | `$SERVER_PORT` or `8080` |
| `--timeout` | `-t` | Connection timeout (ms) | `2000` |
| `--record` | `-r` | Enable session recording | `false` |
| `--recordings-dir` | | Recordings directory | `./recordings` |
| `--log-level` | | Logging level (error/warn/info/debug) | `info` |
| `--auto-reconnect` | | Auto-reconnect on disconnection | `true` |
| `--max-reconnect-attempts` | | Max reconnection attempts | `3` |
| `--reconnect-delay` | | Delay between reconnects (ms) | `1000` |
| `--interactive` | `-i` | Start in interactive mode | `false` |

### Replay Application (`yarn replay`)

| Option | Description | Default |
|--------|-------------|---------|
| `--recordings-dir` | Recordings directory | `./recordings` |
| `--auto-play` | Enable auto-play mode | `false` |
| `--auto-play-delay` | Auto-play step delay (ms) | `1000` |

### Recording Management Commands

| Command | Description | Example |
|---------|-------------|---------|
| `yarn list-recordings` | List all session recordings | `yarn list-recordings` |
| `yarn cleanup-recordings` | Delete recordings | `yarn cleanup-recordings` |
| `yarn export-recording` | Export to CSV/text | `yarn export-recording file` |

### Development & Utility Commands

| Command | Description | Use Case |
|---------|-------------|----------|
| `yarn dev` | Development mode with hot reload | Auto-restart on file changes |
| `yarn dev:interactive` | Interactive mode with hot reload | Develop TUI |
| `yarn setup` | Initial project setup | First-time installation setup |
| `yarn lint` | Run ESLint code linting | Check code style and quality |

#### Development Commands Usage

```bash
# Development mode - automatically restarts when files change
yarn dev

# Interactive development mode - TUI with hot reload  
yarn dev:interactive

# Initial project setup (runs automatically after yarn install)
yarn setup

# Lint code for style and quality issues
yarn lint

# Fix auto-fixable linting issues
yarn lint --fix
```

## Examples

### Example 1: Basic Connection (Automatic Mode)

```bash
yarn start
```

Output:

```text
🔌 MiniTel-Lite Protocol Client v1.0.0
=====================================

📋 Configuration Summary:
   Server: your.server.com:8080
   Timeout: 2000ms
   Recording: ❌ Disabled
   Log Level: info
   Auto Reconnect: ✅ Enabled

🔗 Connected to your.server.com:8080

🚀 Starting MiniTel-Lite protocol sequence...

1️⃣  Sending HELLO command...
   ✅ Received HELLO_ACK (nonce: 1)

2️⃣  Sending first DUMP command...
   ❌ DUMP #1: FAILED (nonce: 3)

3️⃣  Sending second DUMP command...
   ✅ DUMP #2: SUCCESS (nonce: 5)
   📄 Payload: SECRET_CODE_12345

🎯 Successfully retrieved code with 1 successful DUMP!

📊 Protocol sequence completed
   Total successful DUMPs: 1
   Final nonce: 6

✅ Application completed successfully
🛑 Application stopped
```

### Example 2: With Session Recording

```bash
yarn start --host server.local --record --log-level debug
```

Output:

```text
🔌 MiniTel-Lite Protocol Client v1.0.0
=====================================

📋 Configuration Summary:
   Server: server.local:8080
   Timeout: 2000ms
   Recording: ✅ Enabled
   Recordings Directory: /path/to/recordings
   Log Level: debug

📝 Session recording started: session_2023-09-17T10-30-15-456Z_ef789012

🔗 Connected to server.local:8080
🚀 Starting MiniTel-Lite protocol sequence...
...
✅ Session recording stopped: session_2023-09-17T10-30-15-456Z_ef789012
📁 Recording saved to: /path/to/recordings/session_2023-09-17T10-30-15-456Z_ef789012.json
📊 Total interactions recorded: 6
```

### Example 3: Interactive Mode ✨

```bash
yarn start:interactive:record
```

The interactive TUI will launch:

```text
┌─ 🎮 MiniTel Interactive Client v1.0.0 ──────────────────────────────────┐
│                 Server: your.server.com:8080 | Recording: ✅             │
└────────────────────────────────────────────────────────────────────────┘
┌─ Connection Status ──────┬─ Commands ──────────────────────────────────┐
│ 🟢 Status: CONNECTED     │ [H] - Send HELLO command                   │
│                          │ [D] - Send DUMP command                    │
│ 📊 Session Info:         │ [S] - Send STOP command                    │
│    • HELLO sent: ✅      │ [Q] - Quit application                     │
│    • Successful DUMPs: 2 │ [?] - Show detailed help                   │
│    • Last nonce: 3       │                                             │
└──────────────────────────┴─────────────────────────────────────────────┘
┌─ Activity Log ───────────────────────────────────────────────────────────┐
│ [10:30:15] 🎮 Interactive mode started. Use keys to send commands:      │
│ [10:30:16] 🔗 Connected to server                                       │
│ [10:30:18] 📤 Sending HELLO command...                                  │
│ [10:30:18] ✅ Received HELLO_ACK (nonce: 1)                            │
│ [10:30:22] 📤 Sending DUMP command...                                   │
│ [10:30:22] ✅ DUMP SUCCESS (nonce: 3)                                   │
│ [10:30:22] 📄 Payload: ABC123                                           │
└────────────────────────────────────────────────────────────────────────┘
           Press [H] HELLO  [D] DUMP  [S] STOP  [Q] Quit  [?] Help
```

### Example 4: Session Replay

```bash
# First, list available recordings
yarn list-recordings

# Then replay a specific session
yarn replay session_2025-09-18T03-41-44-357Z_5edf9a7a.json
```

The TUI will display:

```text
┌─ Session Information ─────────────────────────────────────────────┐
│  Session ID: session_2025-09-18T03-41-44-357Z_5edf9a7a          │
│  Server: your.server.com:8080                                     │
│  Started: 9/18/2025, 12:41:44 AM                                │
│  Ended: 9/18/2025, 12:41:45 AM                                  │
│  Total Steps: 6                                                  │
└───────────────────────────────────────────────────────────────────┘
┌─ Interaction Details ─────────────────────────────────────────────┐
│  Step 1 of 6                                                     │
│                                                                   │
│  → REQUEST                                                        │
│  Timestamp: 9/18/2025, 12:41:44 AM                              │
│  Command: HELLO                                                   │
│  Nonce: 0                                                        │
│  Direction: client -> server                                     │
│                                                                   │
│  Payload: (empty)                                                │
└───────────────────────────────────────────────────────────────────┘
┌─ Controls ────────────────────────────────────────────────────────┐
│  Progress: 17% | Auto-Play: OFF                                  │
│  N/n: Next | P/p: Previous | A: Toggle Auto-Play | H: Help | Q: Quit │
└───────────────────────────────────────────────────────────────────┘
```

## Architecture & Design

### System Overview

The MiniTel-Lite client follows a **layered architecture** with event-driven
design patterns, ensuring maintainability, testability, and graceful edge case
handling:

```text
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
├─────────────────────────────────────────────────────────────┤
│  CLI Interface (index.js)     │  TUI Replay (replay.js)     │
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

### Key Design Decisions & Rationale

#### 1. **Event-Driven Architecture**

```javascript
// Protocol client emits events for loose coupling
client.on('connected', () => handleConnection());
client.on('frameTransmitted', (frame) => recordInteraction(frame));
client.on('error', (error) => handleError(error));
```

**Rationale**: Enables extensibility, testability, and natural integration
points for session recording.

#### 2. **Protocol State Machine**

```text
[Disconnected] --connect()--> [Connecting] --success--> [Connected]
[Connected] --sendHello()--> [Authenticated]  
[Authenticated] --sendDump()--> [Operating]
[Operating] --sendStop()--> [Terminating] --> [Disconnected]
```

**Rationale**: Clear state transitions prevent invalid protocol sequences
and enable proper error recovery.

#### 3. **Hierarchical Error Classification**

```javascript
class MiniTelError extends Error {
  constructor(message, code, details = {}) {
    this.code = code;           // Machine-readable error type
    this.details = details;     // Rich context for debugging
    this.timestamp = new Date().toISOString();
  }
}
```

**Rationale**: Structured error handling enables appropriate responses
and rich debugging information.

### Directory Structure

```text
src/
├── protocol/           # MiniTel-Lite protocol implementation
│   ├── constants.js    # Protocol constants and error types
│   ├── frame.js        # Frame encoding/decoding (heavily commented)
│   └── client.js       # Protocol client with connection management
├── client/             # Main application logic
│   └── application.js  # Application orchestration
├── recorder/           # Session recording system
│   └── session-recorder.js # Recording functionality
├── replay/             # Session replay system
│   └── tui-player.js   # Terminal UI for replay
├── utils/              # Shared utilities
│   ├── config.js       # Configuration management
│   ├── logger.js       # Logging utilities
│   └── errors.js       # Error handling and classification
├── index.js            # Main application entry point
└── replay.js           # Replay application entry point
```

## Protocol Implementation

The client implements the complete MiniTel-Lite Protocol v3.0 specification:

### Wire Format

```text
LEN (2 bytes, big-endian) | DATA_B64 (LEN bytes, Base64 encoded)
```

### Binary Frame Structure

```text
CMD (1 byte) | NONCE (4 bytes, big-endian) | PAYLOAD (0-65535 bytes) | HASH (32 bytes)
```

### Supported Commands

- **HELLO (0x01)**: Initialize connection and nonce tracking
- **DUMP (0x02)**: Request memory dump (may return DUMP_OK or DUMP_FAILED)  
- **STOP_CMD (0x03)**: Graceful connection termination

### Error Handling

The client handles all protocol violations as specified:

- Invalid nonce → Immediate disconnection
- Unknown command → Immediate disconnection  
- Malformed frame → Immediate disconnection
- Hash validation failure → Immediate disconnection
- Invalid Base64 → Immediate disconnection

## Logging

Comprehensive logging is provided through Winston:

- **Error logs**: `logs/error.log`
- **Combined logs**: `logs/combined.log`
- **Console output**: Development mode only

Log levels: `error`, `warn`, `info`, `debug`

## Recording Format

Session recordings are stored as JSON with the following structure:

```json
{
  "metadata": {
    "sessionId": "session_2023-09-17T10-30-15-456Z_ef789012",
    "startTime": "2023-09-17T10:30:15.456Z",
    "endTime": "2023-09-17T10:30:18.789Z",
    "totalSteps": 6,
    "serverHost": "localhost",
    "serverPort": 8080,
    "duration": 3333,
    "protocolVersion": "3.0"
  },
  "interactions": [
    {
      "stepNumber": 1,
      "timestamp": "2023-09-17T10:30:15.456Z",
      "type": "request",
      "command": "HELLO",
      "nonce": 0,
      "payload": "",
      "payloadSize": 0,
      "metadata": {
        "direction": "client -> server"
      }
    }
  ]
}
```

## Testing

### Running Tests

The application includes comprehensive unit and integration tests with
**105 tests across 5 test suites** all passing:

```bash
# Run all tests
yarn test

# Run specific test suites  
yarn test:unit              # Unit tests only
yarn test:integration       # Integration tests only

# Development testing
yarn test:watch             # Watch mode for development
yarn test:coverage          # Generate coverage report
yarn test:verbose           # Detailed test output

# Custom test runner
yarn test:help              # Show test runner options
```

### Development Workflow

For active development, use these commands together:

```bash
# 1. Start development mode with hot reload
yarn dev                    # Automatic mode with file watching
yarn dev:interactive        # Interactive mode with file watching

# 2. Run tests continuously during development  
yarn test:watch             # Watch mode - reruns tests on file changes

# 3. Check code quality
yarn lint                   # Check JavaScript and markdown files
yarn lint:js                # Check JavaScript code style only  
yarn lint:md                # Check markdown files only
yarn lint:md:fix            # Auto-fix markdown issues where possible

# 4. Run full test suite before committing
yarn test                   # Run all tests
yarn test:coverage          # Generate coverage report
```

**Recommended Development Flow:**

1. Run `yarn dev` or `yarn dev:interactive` in one terminal
2. Run `yarn test:watch` in another terminal  
3. Make code changes - both will automatically reload/rerun
4. Run `yarn lint` before committing changes
5. Run `yarn test` for final verification

### Test Architecture

```text
tests/
├── unit/                   # Unit tests (isolated components)
│   ├── protocol/          # Protocol encoding/decoding tests
│   ├── client/            # Client logic tests  
│   ├── recorder/          # Recording functionality tests
│   └── utils/             # Utility function tests
├── integration/           # Integration tests (full flows)
│   └── application.test.js # Complete application scenarios
├── mocks/                 # Test mocks and utilities
│   └── net-mock.js       # Network socket mocking
├── fixtures/              # Test data and scenarios  
│   └── protocol-fixtures.js # Pre-defined test frames
└── temp/                  # Temporary test files
```

### Edge Case Testing Coverage

#### 1. **Network Disconnections**

```javascript
// Tests unexpected server disconnection during protocol sequence
test('should handle disconnection during DUMP sequence', async () => {
  const mock = new MockSocket({
    shouldConnect: true,
    shouldDisconnect: true,
    disconnectDelay: 100 // Disconnect after HELLO
  });
  
  await expect(app.start()).rejects.toThrow();
});
```

#### 2. **Protocol Violations**

```javascript
// Tests invalid nonce sequence detection
test('should reject response with invalid nonce', async () => {
  const wrongNonceResponse = encodeFrame(RESPONSES.HELLO_ACK, 999, '');
  
  const errorPromise = new Promise(resolve => client.on('error', resolve));
  const error = await errorPromise;
  expect(error.message).toBe(PROTOCOL_ERRORS.INVALID_NONCE);
});
```

#### 3. **Frame Processing Edge Cases**

```javascript
// Tests partial frame reception (TCP streaming)
test('should handle partial frame reception', async () => {
  const fullFrame = encodeFrame(RESPONSES.HELLO_ACK, 1, '');
  const part1 = fullFrame.subarray(0, fullFrame.length / 2);
  const part2 = fullFrame.subarray(fullFrame.length / 2);
  
  // Send frame in parts
  mockSocket.simulateData(part1);
  await delay(10);
  mockSocket.simulateData(part2);
  
  const response = await responsePromise;
  expect(response.cmd).toBe(RESPONSES.HELLO_ACK);
});
```

#### 4. **Resource Exhaustion**

```javascript
// Tests payload size limits
test('should reject oversized payload', () => {
  const oversizedPayload = 'x'.repeat(65536);
  expect(() => {
    encodeFrame(COMMANDS.HELLO, 0, oversizedPayload);
  }).toThrow('Payload size exceeds maximum');
});
```

#### 5. **Auto-Reconnection Logic**

```javascript
// Tests successful recovery after connection failure
test('should succeed after reconnection', async () => {
  // First connection fails, second succeeds
  let connectionAttempts = 0;
  jest.spyOn(net, 'Socket').mockImplementation(() => {
    connectionAttempts++;
    return connectionAttempts === 1 
      ? new MockSocket({ shouldConnect: false })
      : new MockSocket({ shouldConnect: true, mockResponses: [...] });
  });
  
  await app.start();
  expect(connectionAttempts).toBe(2);
});
```

### Coverage Reports

```bash
# Generate and view coverage report
yarn test:coverage
open coverage/lcov-report/index.html
```

**Coverage Requirements Met**:

- **Branches**: 80%+ (protocol edge cases, error paths)
- **Functions**: 80%+ (all major functions tested)  
- **Lines**: 80%+ (comprehensive line coverage)
- **Statements**: 80%+ (statement-level testing)

## Edge Case Handling

### 1. **Network-Level Edge Cases**

#### Connection Failures

- **ECONNREFUSED**: Graceful error with retry logic
- **ETIMEDOUT**: Configurable timeout with fallback
- **DNS Resolution**: Clear error messages for invalid hosts

#### Unexpected Disconnections  

- **During HELLO**: Retry with exponential backoff
- **During DUMP sequence**: Complete current operation, then reconnect
- **Server shutdown**: Graceful cleanup and user notification

#### TCP Streaming Issues

- **Partial frames**: Buffer accumulation until complete frame
- **Multiple frames**: Process all frames from single data event  
- **Frame boundaries**: Length-prefix based boundary detection

### 2. **Protocol-Level Edge Cases**

#### Frame Validation

```javascript
// Hash validation prevents tampering
const calculatedHash = calculateHash(cmd, nonce, payload);
if (!receivedHash.equals(calculatedHash)) {
  throw new Error(PROTOCOL_ERRORS.HASH_VALIDATION_FAILURE);
}
```

#### Nonce Sequence Protection

```javascript
// Strict nonce sequence validation
if (decodedFrame.nonce !== this.currentNonce - 1) {
  this.emit('error', new Error(PROTOCOL_ERRORS.INVALID_NONCE));
  this.disconnect(); // Immediate disconnection on violation
}
```

#### Malformed Data Handling

- **Invalid Base64**: Proper error classification and recovery
- **Truncated frames**: Wait for complete data before processing
- **Oversized payloads**: Memory protection with size limits

### 3. **Application-Level Edge Cases**

#### Resource Management

- **Memory pressure**: Streaming processing, buffer limits
- **Disk space**: Graceful recording failure handling
- **File permissions**: Clear error messages and fallbacks

#### State Consistency  

- **Concurrent operations**: Event-driven serialization
- **Cleanup on errors**: Proper resource cleanup in all error paths
- **State recovery**: Consistent state after reconnection

### 4. **User Experience Edge Cases**

#### Configuration Validation

```javascript
function validateConfig(config) {
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new ConfigurationError('Invalid port specified (must be 1-65535)');
  }
}
```

#### Graceful Degradation

- **Recording failures**: Continue operation without recording
- **Network issues**: Auto-reconnect with user feedback
- **Protocol errors**: Clear error messages with context

## Troubleshooting

### Connection Issues

1. **ECONNREFUSED**: Server is not running or wrong port
2. **ENOTFOUND**: Invalid hostname  
3. **Timeout**: Server not responding within timeout period

### Protocol Issues

1. **Invalid nonce**: Check server implementation
2. **Hash validation failure**: Network corruption or implementation bug
3. **Unknown command**: Server doesn't support command

### Recording Issues

1. **Permission denied**: Check write permissions to recordings directory
2. **Disk space**: Ensure sufficient disk space for recordings
3. **Invalid JSON**: Recording file may be corrupted

## Development

### Setup Development Environment

```bash
# Ensure correct Node.js version
nvm use

# Install dependencies
yarn install

# Watch mode with auto-restart
yarn dev

# Debug logging
yarn start --log-level debug

# Lint code
yarn lint
```

### Environment Variables Reference

- `NODE_ENV`: Set to `production` to disable console logging
- `LOG_LEVEL`: Override default log level
- `SERVER_HOST`: Override default server hostname
- `SERVER_PORT`: Override default server port

## License

MIT License - see LICENSE file for details.

## 📚 Documentation

### Core Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)**: Architecture design and component details
- **[TESTING.md](TESTING.md)**: Testing guide with edge case coverage
- **[CONFIGURATION.md](CONFIGURATION.md)**: Complete configuration options and examples
- **[TEST-SUMMARY.md](TEST-SUMMARY.md)**: Testing summary and coverage details

### Quick Reference

- **Architecture**: Event-driven, layered architecture with edge case handling
- **Testing**: 105 tests covering unit, integration, and edge case scenarios
- **Edge Cases**: TCP streaming, protocol violations, resource exhaustion
- **Documentation**: All complex code sections thoroughly commented for clarity

### Command Quick Reference

| Category | Command | Description |
|----------|---------|-------------|
| **Basic Usage** | `yarn start` | Run automatic protocol sequence |
| | `yarn start:record` | Run with session recording |
| | `yarn interactive` | Run interactive TUI mode |
| | `yarn start:interactive:record` | Interactive mode with recording |
| **Development** | `yarn dev` | Development mode with hot reload |
| | `yarn dev:interactive` | Interactive dev mode |
| | `yarn lint` | Check code and markdown style |
| | `yarn lint:js` | Check JavaScript code style only |
| | `yarn lint:md` | Check markdown files only |
| | `yarn lint:md:fix` | Auto-fix markdown issues |
| | `yarn setup` | Initial project setup |
| **Recording** | `yarn list-recordings` | List all session recordings |
| | `yarn replay <file.json>` | Replay a session |
| | `yarn cleanup-recordings` | Delete old recordings |
| | `yarn export-recording <file> <format>` | Export recording |
| **Testing** | `yarn test` | Run all tests |
| | `yarn test:unit` | Run unit tests only |
| | `yarn test:integration` | Run integration tests only |
| | `yarn test:watch` | Watch mode for development |

## 🧪 Testing Implementation

This project includes comprehensive testing that validates:

### Server Disconnection Scenarios

- ✅ Connection establishment failures  
- ✅ Unexpected disconnections during protocol execution
- ✅ Auto-reconnection with exponential backoff
- ✅ Graceful cleanup and error recovery

### Protocol Validation Edge Cases

- ✅ Hash validation failures (integrity protection)
- ✅ Nonce sequence violations (security validation)
- ✅ Malformed frame rejection (robustness)
- ✅ TCP streaming issues (partial/multiple frames)

### Resource & Error Handling

- ✅ Memory exhaustion protection (payload limits)
- ✅ File system error handling (disk space, permissions)
- ✅ Network timeout and recovery scenarios
- ✅ State consistency across all error conditions

**Run Tests**: See [TESTING.md](TESTING.md) for complete testing instructions.

## Support

For issues and questions:

1. **Check logs**: Review files in `logs/` directory for detailed error information
2. **Run tests**: Execute `yarn test` to verify system functionality  
3. **Review documentation**: See documentation files above for detailed explanations
4. **Server compatibility**: Ensure server implements MiniTel-Lite Protocol v3.0
