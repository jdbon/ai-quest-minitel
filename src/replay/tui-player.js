/**
 * TUI Player for Session Recordings
 * Provides an interactive terminal interface for replaying sessions
 */

const blessed = require('blessed');

class TUIPlayer {
  constructor(sessionData, options = {}) {
    this.sessionData = sessionData;
    this.options = options;
    this.currentStep = 0;
    this.totalSteps = sessionData.interactions.length;
    this.autoPlay = options.autoPlay || false;
    this.autoPlayDelay = options.autoPlayDelay || 1000;
    this.autoPlayTimer = null;

    this.screen = null;
    this.headerBox = null;
    this.contentBox = null;
    this.footerBox = null;
  }

  /**
   * Initialize and show the TUI
   */
  start() {
    this._initializeUI();
    this._bindKeyEvents();
    this._updateDisplay();

    if (this.autoPlay) {
      this._startAutoPlay();
    }

    this.screen.render();
  }

  /**
   * Initialize the blessed UI components
   * @private
   */
  _initializeUI() {
    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'MiniTel Session Replay',
      dockBorders: true
    });

    // Header box - session info
    this.headerBox = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 8,
      content: '',
      border: {
        type: 'line'
      },
      style: {
        fg: 'cyan',
        border: {
          fg: 'cyan'
        }
      },
      label: ' Session Information ',
      padding: {
        left: 2,
        right: 2,
        top: 1
      }
    });

    // Main content box - interaction details
    this.contentBox = blessed.box({
      top: 8,
      left: 0,
      width: '100%',
      height: '100%-11',
      content: '',
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'white'
        }
      },
      label: ' Interaction Details ',
      padding: {
        left: 2,
        right: 2,
        top: 1
      },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'cyan'
        },
        style: {
          inverse: true
        }
      }
    });

    // Footer box - controls
    this.footerBox = blessed.box({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '',
      border: {
        type: 'line'
      },
      style: {
        fg: 'yellow',
        border: {
          fg: 'yellow'
        }
      },
      label: ' Controls ',
      padding: {
        left: 2,
        right: 2
      }
    });

    // Add boxes to screen
    this.screen.append(this.headerBox);
    this.screen.append(this.contentBox);
    this.screen.append(this.footerBox);
  }

  /**
   * Bind keyboard events
   * @private
   */
  _bindKeyEvents() {
    // Quit application
    this.screen.key(['q', 'Q', 'C-c'], () => {
      this._stopAutoPlay();
      process.exit(0);
    });

    // Next step
    this.screen.key(['n', 'N', 'right', 'space'], () => {
      this._stopAutoPlay();
      this.nextStep();
    });

    // Previous step
    this.screen.key(['p', 'P', 'left'], () => {
      this._stopAutoPlay();
      this.previousStep();
    });

    // Toggle auto-play
    this.screen.key(['a', 'A'], () => {
      this.toggleAutoPlay();
    });

    // Jump to first step
    this.screen.key(['home', '1'], () => {
      this._stopAutoPlay();
      this.jumpToStep(0);
    });

    // Jump to last step
    this.screen.key(['end', '0'], () => {
      this._stopAutoPlay();
      this.jumpToStep(this.totalSteps - 1);
    });

    // Help
    this.screen.key(['h', 'H', '?'], () => {
      this._showHelp();
    });
  }

  /**
   * Update the display with current step information
   * @private
   */
  _updateDisplay() {
    this._updateHeader();
    this._updateContent();
    this._updateFooter();
    this.screen.render();
  }

  /**
   * Update header with session metadata
   * @private
   */
  _updateHeader() {
    const metadata = this.sessionData.metadata;
    const startTime = new Date(metadata.startTime).toLocaleString();
    const endTime = metadata.endTime ? new Date(metadata.endTime).toLocaleString() : 'N/A';

    const headerContent = [
      `Session ID: {bold}${metadata.sessionId}{/bold}`,
      `Server: {bold}${metadata.serverHost}:${metadata.serverPort}{/bold}`,
      `Started: {bold}${startTime}{/bold}`,
      `Ended: {bold}${endTime}{/bold}`,
      `Total Steps: {bold}${metadata.totalSteps}{/bold}`
    ].join('\n');

    this.headerBox.setContent(headerContent);
  }

  /**
   * Update content with current interaction details
   * @private
   */
  _updateContent() {
    if (this.totalSteps === 0) {
      this.contentBox.setContent('{center}No interactions recorded{/center}');
      return;
    }

    const interaction = this.sessionData.interactions[this.currentStep];
    if (!interaction) {
      this.contentBox.setContent('{center}Invalid step{/center}');
      return;
    }

    const timestamp = new Date(interaction.timestamp).toLocaleString();
    const typeColor = interaction.type === 'request' ? 'green' : 'blue';
    const directionIcon = interaction.type === 'request' ? '→' : '←';

    const content = [
      `{bold}Step ${interaction.stepNumber} of ${this.totalSteps}{/bold}`,
      '',
      `{${typeColor}}${directionIcon} ${interaction.type.toUpperCase()}{/${typeColor}}`,
      `Timestamp: {bold}${timestamp}{/bold}`,
      `Command: {bold}${interaction.command}{/bold}`,
      `Nonce: {bold}${interaction.nonce}{/bold}`,
      `Direction: {bold}${interaction.metadata.direction}{/bold}`,
      ''
    ];

    if (interaction.payload) {
      content.push('Payload:');
      content.push(`{yellow}${interaction.payload}{/yellow}`);
      content.push('');
      content.push(`Payload Size: {bold}${interaction.payloadSize} bytes{/bold}`);
    } else {
      content.push('Payload: {dim}(empty){/dim}');
    }

    this.contentBox.setContent(content.join('\n'));
    this.contentBox.setScrollPerc(0); // Scroll to top
  }

  /**
   * Update footer with controls information
   * @private
   */
  _updateFooter() {
    const progress = this.totalSteps > 0 ? Math.round((this.currentStep + 1) / this.totalSteps * 100) : 0;
    const autoPlayStatus = this.autoPlay ? '{green}ON{/green}' : '{red}OFF{/red}';

    const footerContent = [
      `Progress: ${progress}% | Auto-Play: ${autoPlayStatus}`,
      'N/n: Next | P/p: Previous | A: Toggle Auto-Play | H: Help | Q: Quit'
    ].join(' | ');

    this.footerBox.setContent(footerContent);
  }

  /**
   * Move to next step
   */
  nextStep() {
    if (this.currentStep < this.totalSteps - 1) {
      this.currentStep++;
      this._updateDisplay();
    } else if (this.autoPlay) {
      // Stop auto-play when reaching the end
      this._stopAutoPlay();
    }
  }

  /**
   * Move to previous step
   */
  previousStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this._updateDisplay();
    }
  }

  /**
   * Jump to specific step
   * @param {number} stepIndex - Step index to jump to
   */
  jumpToStep(stepIndex) {
    if (stepIndex >= 0 && stepIndex < this.totalSteps) {
      this.currentStep = stepIndex;
      this._updateDisplay();
    }
  }

  /**
   * Toggle auto-play mode
   */
  toggleAutoPlay() {
    if (this.autoPlay) {
      this._stopAutoPlay();
    } else {
      this._startAutoPlay();
    }
    this._updateDisplay();
  }

  /**
   * Navigate to next step (private method for tests)
   * @private
   */
  _nextStep() {
    this.nextStep();
  }

  /**
   * Navigate to previous step (private method for tests)
   * @private
   */
  _previousStep() {
    this.previousStep();
  }

  /**
   * Jump to first step (private method for tests)
   * @private
   */
  _firstStep() {
    this.jumpToStep(0);
  }

  /**
   * Jump to last step (private method for tests)
   * @private
   */
  _lastStep() {
    if (this.totalSteps > 0) {
      this.jumpToStep(this.totalSteps - 1);
    }
  }

  /**
   * Toggle auto-play mode (private method for tests)
   * @private
   */
  _toggleAutoPlay() {
    this.toggleAutoPlay();
  }

  /**
   * Start auto-play mode
   * @private
   */
  _startAutoPlay() {
    this.autoPlay = true;
    this._scheduleNextStep();
  }

  /**
   * Stop auto-play mode
   * @private
   */
  _stopAutoPlay() {
    this.autoPlay = false;
    if (this.autoPlayTimer) {
      clearTimeout(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
  }

  /**
   * Schedule the next auto-play step
   * @private
   */
  _scheduleNextStep() {
    if (this.autoPlay) {
      this.autoPlayTimer = setTimeout(() => {
        if (this.currentStep < this.totalSteps - 1) {
          this._nextStep();
          this._scheduleNextStep();
        } else {
          this._stopAutoPlay();
          this._updateDisplay();
        }
      }, this.autoPlayDelay);
    }
  }

  /**
   * Show help dialog
   * @private
   */
  _showHelp() {
    const helpBox = blessed.message({
      parent: this.screen,
      border: 'line',
      height: 'shrink',
      width: 'half',
      top: 'center',
      left: 'center',
      label: ' Help ',
      tags: true,
      keys: true,
      vi: true,
      style: {
        fg: 'white',
        border: {
          fg: 'cyan'
        }
      }
    });

    const helpText = [
      '{bold}Keyboard Controls:{/bold}',
      '',
      '{cyan}Navigation:{/cyan}',
      '  N, n, →, Space - Next step',
      '  P, p, ←       - Previous step',
      '  Home, 1       - Jump to first step',
      '  End, 0        - Jump to last step',
      '',
      '{cyan}Playback:{/cyan}',
      '  A, a           - Toggle auto-play',
      '',
      '{cyan}General:{/cyan}',
      '  H, h, ?        - Show this help',
      '  Q, q, Ctrl+C   - Quit application',
      '',
      '{dim}Press any key to close this help...{/dim}'
    ].join('\n');

    helpBox.display(helpText, () => {
      // Help dialog closed
    });
  }
}

module.exports = TUIPlayer;
