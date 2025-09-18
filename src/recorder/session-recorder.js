/**
 * Session Recording System
 * Captures and stores all client-server interactions
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class SessionRecorder {
  constructor(options = {}) {
    this.enabled = options.enabled !== false; // Default to enabled unless explicitly disabled
    this.isRecording = false; // Whether there's an active recording session
    this.recordingsDir = options.recordingsDir || path.join(process.cwd(), 'recordings');
    this.sessionId = null;
    this.sessionFile = null;
    this.interactions = [];
    this.sessionMetadata = {
      startTime: null,
      endTime: null,
      totalSteps: 0,
      serverHost: null,
      serverPort: null
    };
    this.isSaving = false; // Prevent concurrent file writes
  }

  /**
   * Start recording a new session
   * @param {string} serverHost - Server hostname
   * @param {number} serverPort - Server port
   * @returns {Promise<string>} Session ID
   */
  async startRecording(serverHost, serverPort) {
    if (!this.enabled) {
      return null;
    }

    // Reset save flag for new session
    this.isSaving = false;

    // Generate unique session ID
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const randomId = crypto.randomBytes(4).toString('hex');
    this.sessionId = `session_${timestamp}_${randomId}`;
    this.isRecording = true;

    // Initialize session metadata
    this.sessionMetadata = {
      sessionId: this.sessionId,
      startTime: new Date().toISOString(),
      endTime: null,
      totalSteps: 0,
      serverHost,
      serverPort,
      clientVersion: '1.0.0',
      protocolVersion: '3.0'
    };

    // Clear interactions array
    this.interactions = [];

    // Ensure recordings directory exists
    try {
      await fs.mkdir(this.recordingsDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw new Error(`Failed to create recordings directory: ${error.message}`);
      }
    }

    // Set session file path
    this.sessionFile = path.join(this.recordingsDir, `${this.sessionId}.json`);

    console.log(`📝 Session recording started: ${this.sessionId}`);
    return this.sessionId;
  }

  /**
   * Record a client-server interaction
   * @param {Object} interaction - Interaction data
   */
  recordInteraction(interaction) {
    if (!this.isRecording || !this.sessionId) {
      return;
    }

    const step = {
      stepNumber: this.interactions.length + 1,
      timestamp: interaction.timestamp || new Date().toISOString(),
      type: interaction.type, // 'request' or 'response'
      command: interaction.command,
      nonce: interaction.nonce,
      payload: interaction.payload || '',
      payloadSize: Buffer.byteLength(interaction.payload || '', 'utf8'),
      metadata: {
        direction: interaction.type === 'request' ? 'client -> server' : 'server -> client'
      }
    };

    this.interactions.push(step);
    this.sessionMetadata.totalSteps = this.interactions.length;

    // Auto-save after each interaction (for crash recovery)
    this._saveSession().catch(error => {
      console.error(`⚠️  Failed to auto-save session: ${error.message}`);
    });
  }

  /**
   * Stop recording and save final session
   * @returns {Promise<string>} Final session file path
   */
  async stopRecording() {
    if (!this.isRecording || !this.sessionId) {
      return null;
    }

    this.sessionMetadata.endTime = new Date().toISOString();
    this.sessionMetadata.duration = new Date(this.sessionMetadata.endTime) - new Date(this.sessionMetadata.startTime);

    const finalSessionFile = await this._saveSession();

    console.log(`✅ Session recording stopped: ${this.sessionId}`);
    console.log(`📁 Recording saved to: ${finalSessionFile}`);
    console.log(`📊 Total interactions recorded: ${this.sessionMetadata.totalSteps}`);

    // Reset session state
    this.isRecording = false;
    this.sessionId = null;
    this.sessionFile = null;
    this.interactions = [];

    return finalSessionFile;
  }

  /**
   * Save session data to file
   * @private
   * @returns {Promise<string>} Session file path
   */
  async _saveSession() {
    if (!this.sessionFile) {
      throw new Error('No active recording session');
    }

    // Wait for any ongoing save to complete, then proceed
    while (this.isSaving) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    this.isSaving = true;
    try {
      const sessionData = {
        metadata: { ...this.sessionMetadata },
        interactions: [...this.interactions]
      };

      await fs.writeFile(this.sessionFile, JSON.stringify(sessionData, null, 2), 'utf8');
      return this.sessionFile;
    } catch (error) {
      throw new Error(`Failed to save session recording: ${error.message}`);
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Get recording status
   * @returns {Object} Recording status
   */
  getStatus() {
    return {
      isRecording: this.isRecording,
      sessionId: this.sessionId,
      interactionCount: this.interactions.length,
      sessionFile: this.sessionFile,
      recordingsDir: this.recordingsDir
    };
  }

  /**
   * List all available recording files
   * @returns {Promise<Array>} List of recording files with metadata
   */
  async listRecordings() {
    try {
      const files = await fs.readdir(this.recordingsDir);
      const recordings = [];

      for (const file of files) {
        if (file.endsWith('.json') && file.startsWith('session_')) {
          const filePath = path.join(this.recordingsDir, file);
          try {
            const stats = await fs.stat(filePath);
            const content = await fs.readFile(filePath, 'utf8');
            const sessionData = JSON.parse(content);

            recordings.push({
              filename: file,
              filePath,
              sessionId: sessionData.metadata.sessionId,
              startTime: sessionData.metadata.startTime,
              endTime: sessionData.metadata.endTime,
              totalSteps: sessionData.metadata.totalSteps,
              serverHost: sessionData.metadata.serverHost,
              serverPort: sessionData.metadata.serverPort,
              fileSize: stats.size,
              lastModified: stats.mtime
            });
          } catch (error) {
            console.warn(`⚠️  Skipping invalid recording file: ${file}`);
          }
        }
      }

      // Sort by creation time (newest first)
      recordings.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
      return recordings;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw new Error(`Failed to list recordings: ${error.message}`);
    }
  }

  /**
   * Load a specific recording session
   * @param {string} filename - Recording filename
   * @returns {Promise<Object>} Session data
   */
  async loadRecording(filename) {
    const filePath = path.join(this.recordingsDir, filename);

    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load recording "${filename}": ${error.message}`);
    }
  }

  /**
   * Delete a recording file
   * @param {string} filename - Recording filename
   * @returns {Promise<void>}
   */
  async deleteRecording(filename) {
    const filePath = path.join(this.recordingsDir, filename);

    try {
      await fs.unlink(filePath);
      console.log(`🗑️  Deleted recording: ${filename}`);
    } catch (error) {
      throw new Error(`Failed to delete recording "${filename}": ${error.message}`);
    }
  }

  /**
   * Export recording in different formats
   * @param {string} filename - Recording filename
   * @param {string} format - Export format ('json', 'csv', 'txt')
   * @returns {Promise<string>} Exported content
   */
  async exportRecording(filename, format = 'json') {
    const sessionData = await this.loadRecording(filename);

    switch (format.toLowerCase()) {
    case 'json':
      return JSON.stringify(sessionData, null, 2);

    case 'csv': {
      let csv = 'Step,Timestamp,Type,Command,Nonce,Payload,Direction\n';
      for (const interaction of sessionData.interactions) {
        const payload = interaction.payload.replace(/"/g, '""'); // Escape quotes
        csv += `${interaction.stepNumber},"${interaction.timestamp}","${interaction.type}","${interaction.command}",${interaction.nonce},"${payload}","${interaction.metadata.direction}"\n`;
      }
      return csv;
    }

    case 'txt': {
      let txt = `Session Recording: ${sessionData.metadata.sessionId}\n`;
      txt += `Start Time: ${sessionData.metadata.startTime}\n`;
      txt += `End Time: ${sessionData.metadata.endTime}\n`;
      txt += `Server: ${sessionData.metadata.serverHost}:${sessionData.metadata.serverPort}\n`;
      txt += `Total Steps: ${sessionData.metadata.totalSteps}\n\n`;

      for (const interaction of sessionData.interactions) {
        txt += `[${interaction.stepNumber}] ${interaction.timestamp} ${interaction.metadata.direction}\n`;
        txt += `Command: ${interaction.command} (Nonce: ${interaction.nonce})\n`;
        if (interaction.payload) {
          txt += `Payload: ${interaction.payload}\n`;
        }
        txt += '\n';
      }
      return txt;
    }

    default:
      throw new Error(`Unsupported export format: ${format}`);
    }
  }
}

module.exports = SessionRecorder;
