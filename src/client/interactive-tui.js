/**
 * Interactive TUI for MiniTel-Lite Protocol Client
 * Provides manual control over protocol commands
 */

const blessed = require('blessed');
const { RESPONSES } = require('../protocol/constants');

class InteractiveTUI {
  constructor(client, options = {}) {
    this.client = client;
    this.options = options;
    this.isRunning = false;
    this.onExit = options.onExit || (() => {}); // Callback for cleanup before exit

    this.screen = null;
    this.headerBox = null;
    this.statusBox = null;
    this.logBox = null;
    this.commandBox = null;
    this.footerBox = null;

    this.logs = [];
    this.connectionStatus = 'disconnected';
    this.lastNonce = 0;
    this.dumpCount = 0;
    this.helloSent = false;
  }

  /**
   * Start the interactive TUI
   */
  start() {
    this.isRunning = true;
    this._initializeUI();
    this._bindKeyEvents();
    this._setupClientEvents();
    this._updateDisplay();
    this.screen.render();

    this._log('🎮 Interactive mode started. Use keys to send commands:');
    this._log('  [H] - Send HELLO command');
    this._log('  [D] - Send DUMP command');
    this._log('  [S] - Send STOP command');
    this._log('  [Q] - Quit application');
    this._log('  [?] - Show help');
  }

  /**
   * Stop the interactive TUI
   */
  stop() {
    this.isRunning = false;
    if (this.screen) {
      this.screen.destroy();
    }
  }

  /**
   * Initialize the blessed UI components
   * @private
   */
  _initializeUI() {
    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'MiniTel Interactive Client',
      dockBorders: true
    });

    // Header box
    this.headerBox = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: this._getHeaderContent(),
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'blue',
        border: {
          fg: 'cyan'
        }
      }
    });

    // Status box
    this.statusBox = blessed.box({
      top: 3,
      left: 0,
      width: '50%',
      height: 8,
      content: '',
      tags: true,
      border: {
        type: 'line'
      },
      label: ' Connection Status ',
      style: {
        fg: 'white',
        border: {
          fg: 'yellow'
        }
      }
    });

    // Command help box
    this.commandBox = blessed.box({
      top: 3,
      left: '50%',
      width: '50%',
      height: 8,
      content: this._getCommandHelp(),
      tags: true,
      border: {
        type: 'line'
      },
      label: ' Commands ',
      style: {
        fg: 'white',
        border: {
          fg: 'green'
        }
      }
    });

    // Log box (scrollable)
    this.logBox = blessed.log({
      top: 11,
      left: 0,
      width: '100%',
      height: '100%-14',
      content: '',
      tags: true,
      border: {
        type: 'line'
      },
      label: ' Activity Log ',
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      style: {
        fg: 'white',
        border: {
          fg: 'cyan'
        }
      }
    });

    // Footer box
    this.footerBox = blessed.box({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}Press [H] HELLO  [D] DUMP  [S] STOP  [Q] Quit  [?] Help{/center}',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'black',
        bg: 'white',
        border: {
          fg: 'gray'
        }
      }
    });

    // Add all components to screen
    this.screen.append(this.headerBox);
    this.screen.append(this.statusBox);
    this.screen.append(this.commandBox);
    this.screen.append(this.logBox);
    this.screen.append(this.footerBox);

    // Focus on log box for scrolling
    this.logBox.focus();
  }

  /**
   * Bind keyboard events
   * @private
   */
  _bindKeyEvents() {
    // Quit
    this.screen.key(['escape', 'q', 'Q', 'C-c'], async() => {
      this._log('👋 Exiting interactive mode...');

      // Give a moment for the log message to display
      await new Promise(resolve => setTimeout(resolve, 500));

      // Call cleanup callback before exiting
      try {
        await this.onExit();
      } catch (error) {
        // Ignore cleanup errors during exit
      }

      process.exit(0);
    });

    // Help
    this.screen.key(['?', 'h', 'H'], () => {
      if (!this.client.isConnected) {
        this._log('❌ Not connected to server. Cannot send HELLO.');
        return;
      }
      this._sendHello();
    });

    // DUMP command
    this.screen.key(['d', 'D'], () => {
      if (!this.client.isConnected) {
        this._log('❌ Not connected to server. Cannot send DUMP.');
        return;
      }
      if (!this.helloSent) {
        this._log('❌ Must send HELLO command first before DUMP.');
        return;
      }
      this._sendDump();
    });

    // STOP command
    this.screen.key(['s', 'S'], () => {
      if (!this.client.isConnected) {
        this._log('❌ Not connected to server. Cannot send STOP.');
        return;
      }
      this._sendStop();
    });

    // Show help
    this.screen.key(['F1'], () => {
      this._showHelp();
    });

    // Scroll log
    this.screen.key(['up'], () => {
      this.logBox.scroll(-1);
      this.screen.render();
    });

    this.screen.key(['down'], () => {
      this.logBox.scroll(1);
      this.screen.render();
    });

    this.screen.key(['pageup'], () => {
      this.logBox.scroll(-10);
      this.screen.render();
    });

    this.screen.key(['pagedown'], () => {
      this.logBox.scroll(10);
      this.screen.render();
    });
  }

  /**
   * Setup client event handlers
   * @private
   */
  _setupClientEvents() {
    this.client.on('connected', () => {
      this.connectionStatus = 'connected';
      this._log('🔗 Connected to server');
      this._updateDisplay();
    });

    this.client.on('disconnected', () => {
      this.connectionStatus = 'disconnected';
      this._log('📡 Disconnected from server');
      this._updateDisplay();
    });

    this.client.on('error', (error) => {
      this._log(`❌ Error: ${error.message}`);
    });

    this.client.on('frameReceived', (frame) => {
      this.lastNonce = frame.nonce;
      if (frame.cmd === RESPONSES.DUMP_OK) {
        this.dumpCount++;
      }
      this._updateDisplay();
    });
  }

  /**
   * Send HELLO command
   * @private
   */
  async _sendHello() {
    try {
      this._log('📤 Sending HELLO command...');
      const response = await this.client.sendHello();
      this.helloSent = true;
      this._log(`✅ Received HELLO_ACK (nonce: ${response.nonce})`);
    } catch (error) {
      this._log(`❌ HELLO failed: ${error.message}`);
    }
  }

  /**
   * Send DUMP command
   * @private
   */
  async _sendDump() {
    try {
      this._log('📤 Sending DUMP command...');
      const response = await this.client.sendDump();
      const isSuccess = response.cmd === RESPONSES.DUMP_OK;

      this._log(`${isSuccess ? '✅' : '❌'} DUMP ${isSuccess ? 'SUCCESS' : 'FAILED'} (nonce: ${response.nonce})`);

      if (response.payloadString) {
        this._log(`📄 Payload: ${response.payloadString}`);
      }
    } catch (error) {
      this._log(`❌ DUMP failed: ${error.message}`);
    }
  }

  /**
   * Send STOP command
   * @private
   */
  async _sendStop() {
    try {
      this._log('📤 Sending STOP command...');
      const response = await this.client.sendStop();
      this._log(`✅ Received STOP_OK (nonce: ${response.nonce})`);
      this._log('🛑 Server acknowledged STOP command');
    } catch (error) {
      this._log(`❌ STOP failed: ${error.message}`);
    }
  }

  /**
   * Show help dialog
   * @private
   */
  _showHelp() {
    const helpBox = blessed.message({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: 60,
      height: 15,
      content: this._getDetailedHelp(),
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'blue'
        }
      }
    });

    helpBox.display('', 0, () => {
      this.screen.render();
    });
  }

  /**
   * Add log entry
   * @private
   */
  _log(message) {
    const timestamp = new Date().toTimeString().substr(0, 8);
    const logEntry = `[${timestamp}] ${message}`;
    this.logs.push(logEntry);
    this.logBox.log(logEntry);
    this.screen.render();
  }

  /**
   * Update the display
   * @private
   */
  _updateDisplay() {
    if (!this.screen) return;

    this.headerBox.setContent(this._getHeaderContent());
    this.statusBox.setContent(this._getStatusContent());
    this.commandBox.setContent(this._getCommandHelp());
    this.screen.render();
  }

  /**
   * Get header content
   * @private
   */
  _getHeaderContent() {
    const config = this.options;
    return '{center}{bold}🎮 MiniTel Interactive Client v1.0.0{/bold}{/center}\n' +
           `{center}Server: ${config.host}:${config.port} | Recording: ${config.record ? '✅' : '❌'}{/center}`;
  }

  /**
   * Get status content
   * @private
   */
  _getStatusContent() {
    const statusColor = this.connectionStatus === 'connected' ? 'green' : 'red';
    const statusIcon = this.connectionStatus === 'connected' ? '🟢' : '🔴';

    return `${statusIcon} Status: {${statusColor}-fg}${this.connectionStatus.toUpperCase()}{/}\n\n` +
           '📊 Session Info:\n' +
           `   • HELLO sent: ${this.helloSent ? '✅' : '❌'}\n` +
           `   • Successful DUMPs: ${this.dumpCount}\n` +
           `   • Last nonce: ${this.lastNonce}`;
  }

  /**
   * Get command help content
   * @private
   */
  _getCommandHelp() {
    return '{bold}Available Commands:{/bold}\n\n' +
           '{green-fg}[H]{/} - Send HELLO command\n' +
           '{yellow-fg}[D]{/} - Send DUMP command\n' +
           '{red-fg}[S]{/} - Send STOP command\n' +
           '{blue-fg}[Q]{/} - Quit application\n' +
           '{gray-fg}[?]{/} - Show detailed help';
  }

  /**
   * Get detailed help content
   * @private
   */
  _getDetailedHelp() {
    return '{center}{bold}MiniTel Interactive Client Help{/bold}{/center}\n\n' +
           '{bold}Protocol Commands:{/bold}\n' +
           '• {green-fg}HELLO [H]{/} - Authenticate with server (required first)\n' +
           '• {yellow-fg}DUMP [D]{/}  - Request data dump (requires HELLO first)\n' +
           '• {red-fg}STOP [S]{/}  - Graceful disconnect\n\n' +
           '{bold}Navigation:{/bold}\n' +
           '• {blue-fg}↑/↓{/}       - Scroll log up/down\n' +
           '• {blue-fg}PgUp/PgDn{/} - Scroll log page up/down\n' +
           '• {red-fg}Q/ESC{/}     - Quit application\n\n' +
           '{bold}Protocol Flow:{/bold}\n' +
           '1. Send HELLO to authenticate\n' +
           '2. Send DUMP command(s) to retrieve data\n' +
           '3. Send STOP for graceful shutdown\n\n' +
           '{center}Press any key to close this help{/center}';
  }
}

module.exports = InteractiveTUI;
