/**
 * Main MiniTel Client Application
 * Orchestrates connection, authentication, commands, and recording
 */

const MiniTelClient = require('../protocol/client');
const SessionRecorder = require('../recorder/session-recorder');
const InteractiveTUI = require('./interactive-tui');
const { protocolLogger } = require('../utils/logger');
const { RESPONSES } = require('../protocol/constants');

class MiniTelApplication {
  constructor(config) {
    this.config = config;
    this.client = null;
    this.recorder = null;
    this.isRunning = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 3;
    this.reconnectDelay = config.reconnectDelay || 1000;
  }

  /**
   * Start the application
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRunning) {
      throw new Error('Application is already running');
    }

    this.isRunning = true;
    protocolLogger.logConnection('application_start', {
      host: this.config.host,
      port: this.config.port,
      recordingEnabled: this.config.record
    });

    try {
      // Initialize recorder if recording is enabled
      if (this.config.record) {
        this.recorder = new SessionRecorder({
          enabled: true,
          recordingsDir: this.config.recordingsDir
        });
      }

      // Initialize and connect client
      await this._initializeClient();
      await this._connectWithRetry();

      // Choose between interactive mode and automatic execution
      if (this.config.interactive) {
        await this._startInteractiveMode();
      } else {
        // Execute the main protocol sequence
        await this._executeProtocolSequence();
        console.log('✅ Application completed successfully');
      }

    } catch (error) {
      console.error('❌ Application failed:', error.message);
      protocolLogger.logProtocolError('application_error', { error: error.message });
      throw error;
    } finally {
      await this.stop();
    }
  }

  /**
   * Stop the application
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    protocolLogger.logConnection('application_stop');

    try {
      // Restore console output if we were in interactive mode
      this._restoreConsoleOutput();

      // Stop recording if active
      if (this.recorder) {
        await this.recorder.stopRecording();
      }

      // Disconnect client if connected
      if (this.client && this.client.isConnected) {
        try {
          // Send STOP command for graceful shutdown
          await this.client.sendStop();
        } catch (error) {
          // Ignore errors during shutdown
          protocolLogger.logProtocolError('shutdown_error', { error: error.message });
        }
        this.client.disconnect();
      }
    } catch (error) {
      console.warn('⚠️  Warning during shutdown:', error.message);
    }

    console.log('🛑 Application stopped');
  }

  /**
   * Initialize the protocol client
   * @private
   */
  async _initializeClient() {
    this.client = new MiniTelClient({
      host: this.config.host,
      port: this.config.port,
      timeout: this.config.timeout
    });

    // Set up event handlers
    this.client.on('connected', () => {
      console.log(`🔗 Connected to ${this.config.host}:${this.config.port}`);
      protocolLogger.logConnection('connected', this.client.getState());
      this.reconnectAttempts = 0; // Reset on successful connection
    });

    this.client.on('disconnected', () => {
      console.log('📡 Disconnected from server');
      protocolLogger.logConnection('disconnected');

      // Attempt reconnection if enabled and application is still running
      if (this.config.autoReconnect && this.isRunning &&
          this.reconnectAttempts < this.maxReconnectAttempts) {
        console.log(`🔄 Attempting reconnection (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`);
        setTimeout(() => {
          if (this.isRunning) {
            this._connectWithRetry().catch(error => {
              console.error('❌ Reconnection failed:', error.message);
            });
          }
        }, this.reconnectDelay);
      }
    });

    this.client.on('error', (error) => {
      console.error('❌ Protocol error:', error.message);
      protocolLogger.logProtocolError('client_error', { error: error.message });
    });

    // Set up recording integration
    if (this.recorder) {
      this.client.on('frameTransmitted', (frameData) => {
        this.recorder.recordInteraction(frameData);
        protocolLogger.logFrame(
          frameData.type === 'request' ? 'outbound' : 'inbound',
          frameData
        );
      });
    }
  }

  /**
   * Connect with retry logic
   * @private
   * @returns {Promise<void>}
   */
  async _connectWithRetry() {
    try {
      // Start recording session
      if (this.recorder) {
        await this.recorder.startRecording(this.config.host, this.config.port);
      }

      await this.client.connect();
    } catch (error) {
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        throw new Error(`Failed to connect after ${this.maxReconnectAttempts} attempts: ${error.message}`);
      }

      console.log(`⚠️  Connection failed, retrying in ${this.reconnectDelay}ms... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
      return this._connectWithRetry();
    }
  }

  /**
   * Start interactive mode with TUI
   * @private
   * @returns {Promise<void>}
   */
  async _startInteractiveMode() {
    console.log('\n🎮 Starting interactive mode...');
    console.log('📺 Loading TUI interface...\n');

    // Small delay to let console messages show before TUI takes over
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Suppress console output to prevent interference with TUI
    this._suppressConsoleOutput();

    const tui = new InteractiveTUI(this.client, {
      ...this.config,
      onExit: async() => {
        // Restore console output before exit
        this._restoreConsoleOutput();
      }
    });
    tui.start();

    // Keep the application running in interactive mode
    // The TUI will handle the exit when user quits
    return new Promise(() => {
      // This promise never resolves - the process exits when user quits the TUI
    });
  }

  /**
   * Suppress console output to prevent interference with TUI
   * @private
   */
  _suppressConsoleOutput() {
    // Store original console methods
    this._originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    };

    // Replace console methods with no-ops
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};
    console.info = () => {};

    // Also suppress winston console transport if present
    const { logger } = require('../utils/logger');
    this._removedConsoleTransports = [];

    // Find and remove console transports from winston logger
    logger.transports.forEach((transport, index) => {
      if (transport.name === 'console') {
        this._removedConsoleTransports.push({ transport, index });
        logger.remove(transport);
      }
    });
  }

  /**
   * Restore console output
   * @private
   */
  _restoreConsoleOutput() {
    if (this._originalConsole) {
      console.log = this._originalConsole.log;
      console.error = this._originalConsole.error;
      console.warn = this._originalConsole.warn;
      console.info = this._originalConsole.info;
    }

    // Restore winston console transports if they were removed
    if (this._removedConsoleTransports) {
      const { logger } = require('../utils/logger');
      this._removedConsoleTransports.forEach(({ transport }) => {
        logger.add(transport);
      });
      this._removedConsoleTransports = null;
    }
  }

  /**
   * Execute the main protocol sequence (HELLO + 2x DUMP)
   * @private
   * @returns {Promise<void>}
   */
  async _executeProtocolSequence() {
    console.log('\n🚀 Starting MiniTel-Lite protocol sequence...\n');

    // Step 1: Send HELLO command
    console.log('1️⃣  Sending HELLO command...');
    try {
      const helloResponse = await this.client.sendHello();
      console.log(`   ✅ Received HELLO_ACK (nonce: ${helloResponse.nonce})`);
    } catch (error) {
      throw new Error(`HELLO command failed: ${error.message}`);
    }

    // Step 2: First DUMP command
    console.log('\n2️⃣  Sending first DUMP command...');
    try {
      const dump1Response = await this.client.sendDump();
      const dump1Result = dump1Response.cmd === RESPONSES.DUMP_OK ? 'SUCCESS' : 'FAILED';

      console.log(`   ${dump1Response.cmd === RESPONSES.DUMP_OK ? '✅' : '❌'} DUMP #1: ${dump1Result} (nonce: ${dump1Response.nonce})`);
      if (dump1Response.payloadString) {
        console.log(`   📄 Payload: ${dump1Response.payloadString}`);
      }
    } catch (error) {
      throw new Error(`First DUMP command failed: ${error.message}`);
    }

    // Step 3: Second DUMP command
    console.log('\n3️⃣  Sending second DUMP command...');
    try {
      const dump2Response = await this.client.sendDump();
      const dump2Result = dump2Response.cmd === RESPONSES.DUMP_OK ? 'SUCCESS' : 'FAILED';

      console.log(`   ${dump2Response.cmd === RESPONSES.DUMP_OK ? '✅' : '❌'} DUMP #2: ${dump2Result} (nonce: ${dump2Response.nonce})`);
      if (dump2Response.payloadString) {
        console.log(`   📄 Payload: ${dump2Response.payloadString}`);
      }

      // Check if we got a code from either DUMP
      const clientState = this.client.getState();
      if (clientState.dumpCounter > 0) {
        console.log(`\n🎯 Successfully retrieved code with ${clientState.dumpCounter} successful DUMP${clientState.dumpCounter > 1 ? 's' : ''}!`);
      } else {
        console.log('\n⚠️  No successful DUMP responses received - no code retrieved');
      }
    } catch (error) {
      throw new Error(`Second DUMP command failed: ${error.message}`);
    }

    console.log('\n📊 Protocol sequence completed');
    console.log(`   Total successful DUMPs: ${this.client.getState().dumpCounter}`);
    console.log(`   Final nonce: ${this.client.getState().currentNonce}`);
  }

  /**
   * Get current application status
   * @returns {Object} Application status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      client: this.client ? this.client.getState() : null,
      recorder: this.recorder ? this.recorder.getStatus() : null,
      reconnectAttempts: this.reconnectAttempts,
      config: {
        host: this.config.host,
        port: this.config.port,
        recordingEnabled: this.config.record
      }
    };
  }

  /**
   * Handle graceful shutdown on signals
   * @returns {void}
   */
  setupGracefulShutdown() {
    const shutdownHandler = async(signal) => {
      console.log(`\n🔔 Received ${signal}, initiating graceful shutdown...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdownHandler);
    process.on('SIGTERM', shutdownHandler);

    // Handle uncaught exceptions
    process.on('uncaughtException', async(error) => {
      console.error('💥 Uncaught exception:', error);
      protocolLogger.logProtocolError('uncaught_exception', { error: error.message, stack: error.stack });
      await this.stop();
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async(reason, _promise) => {
      console.error('💥 Unhandled promise rejection:', reason);
      protocolLogger.logProtocolError('unhandled_rejection', { reason });
      await this.stop();
      process.exit(1);
    });
  }
}

module.exports = MiniTelApplication;
