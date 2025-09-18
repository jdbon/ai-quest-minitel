/**
 * Tests for Session Recorder
 * Tests recording functionality, file operations, and data integrity
 */

const fs = require('fs').promises;
const path = require('path');
const SessionRecorder = require('../../../src/recorder/session-recorder');
// Protocol fixtures are available if needed

describe('Session Recorder', () => {
  let recorder;
  let tempRecordingsDir;

  beforeEach(async() => {
    // Create temporary recordings directory
    tempRecordingsDir = path.join(__dirname, '../../temp/recordings');
    await fs.mkdir(tempRecordingsDir, { recursive: true });

    recorder = new SessionRecorder({
      enabled: true,
      recordingsDir: tempRecordingsDir
    });
  });

  afterEach(async() => {
    try {
      // Clean up test files
      const files = await fs.readdir(tempRecordingsDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(tempRecordingsDir, file)))
      );
    } catch (error) {
      // Directory might not exist
    }
  });

  describe('Recording Lifecycle', () => {
    test('should start recording successfully', async() => {
      const sessionId = await recorder.startRecording('localhost', 8080);

      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^session_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_[a-f0-9]{8}$/);

      const status = recorder.getStatus();
      expect(status.isRecording).toBe(true);
      expect(status.sessionId).toBe(sessionId);
    });

    test('should not record when disabled', async() => {
      recorder = new SessionRecorder({ enabled: false });

      const sessionId = await recorder.startRecording('localhost', 8080);
      expect(sessionId).toBeNull();

      const status = recorder.getStatus();
      expect(status.isRecording).toBe(false);
    });

    test('should record interactions', async() => {
      await recorder.startRecording('localhost', 8080);

      const interaction = {
        type: 'request',
        command: 'HELLO',
        nonce: 0,
        payload: '',
        timestamp: new Date().toISOString()
      };

      recorder.recordInteraction(interaction);

      const status = recorder.getStatus();
      expect(status.interactionCount).toBe(1);
    });

    test('should stop recording and save file', async() => {
      const sessionId = await recorder.startRecording('localhost', 8080);

      // Record some interactions
      recorder.recordInteraction({
        type: 'request',
        command: 'HELLO',
        nonce: 0,
        payload: '',
        timestamp: new Date().toISOString()
      });

      const savedFile = await recorder.stopRecording();

      expect(savedFile).toBeDefined();
      expect(savedFile).toContain(sessionId);

      // Verify file exists
      const fileExists = await fs.access(savedFile).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      const status = recorder.getStatus();
      expect(status.isRecording).toBe(false);
      expect(status.sessionId).toBeNull();
    });
  });

  describe('Data Integrity', () => {
    test('should save valid JSON format', async() => {
      await recorder.startRecording('localhost', 8080);

      recorder.recordInteraction({
        type: 'request',
        command: 'HELLO',
        nonce: 0,
        payload: 'test payload',
        timestamp: new Date().toISOString()
      });

      const savedFile = await recorder.stopRecording();

      // Read and parse the saved file
      const fileContent = await fs.readFile(savedFile, 'utf8');
      const sessionData = JSON.parse(fileContent);

      // Verify structure
      expect(sessionData).toHaveProperty('metadata');
      expect(sessionData).toHaveProperty('interactions');
      expect(sessionData.metadata).toHaveProperty('sessionId');
      expect(sessionData.metadata).toHaveProperty('startTime');
      expect(sessionData.metadata).toHaveProperty('totalSteps');
      expect(sessionData.interactions).toHaveLength(1);
    });

    test('should include all required metadata', async() => {
      await recorder.startRecording('test-server.com', 9090);
      const savedFile = await recorder.stopRecording();

      const fileContent = await fs.readFile(savedFile, 'utf8');
      const sessionData = JSON.parse(fileContent);

      const metadata = sessionData.metadata;
      expect(metadata.serverHost).toBe('test-server.com');
      expect(metadata.serverPort).toBe(9090);
      expect(metadata.clientVersion).toBe('1.0.0');
      expect(metadata.protocolVersion).toBe('3.0');
      expect(metadata.startTime).toBeDefined();
      expect(metadata.endTime).toBeDefined();
    });

    test('should record interaction details correctly', async() => {
      await recorder.startRecording('localhost', 8080);

      const testInteraction = {
        type: 'response',
        command: 'DUMP_OK',
        nonce: 5,
        payload: 'SECRET_CODE_12345',
        timestamp: '2023-09-17T10:30:00.123Z'
      };

      recorder.recordInteraction(testInteraction);
      const savedFile = await recorder.stopRecording();

      const fileContent = await fs.readFile(savedFile, 'utf8');
      const sessionData = JSON.parse(fileContent);

      const interaction = sessionData.interactions[0];
      expect(interaction.stepNumber).toBe(1);
      expect(interaction.type).toBe('response');
      expect(interaction.command).toBe('DUMP_OK');
      expect(interaction.nonce).toBe(5);
      expect(interaction.payload).toBe('SECRET_CODE_12345');
      expect(interaction.payloadSize).toBe(17); // Length of 'SECRET_CODE_12345'
      expect(interaction.metadata.direction).toBe('server -> client');
    });
  });

  describe('File Management', () => {
    test('should list recordings', async() => {
      // Create a test recording
      await recorder.startRecording('localhost', 8080);
      await recorder.stopRecording();

      const recordings = await recorder.listRecordings();

      expect(recordings).toHaveLength(1);
      expect(recordings[0]).toHaveProperty('filename');
      expect(recordings[0]).toHaveProperty('sessionId');
      expect(recordings[0]).toHaveProperty('totalSteps');
      expect(recordings[0]).toHaveProperty('serverHost');
      expect(recordings[0]).toHaveProperty('serverPort');
    });

    test('should handle empty recordings directory', async() => {
      const recordings = await recorder.listRecordings();
      expect(recordings).toHaveLength(0);
    });

    test('should load existing recording', async() => {
      // Create and save a recording
      await recorder.startRecording('localhost', 8080);
      recorder.recordInteraction({
        type: 'request',
        command: 'HELLO',
        nonce: 0,
        payload: '',
        timestamp: new Date().toISOString()
      });
      const savedFile = await recorder.stopRecording();

      const filename = path.basename(savedFile);
      const loadedData = await recorder.loadRecording(filename);

      expect(loadedData.metadata).toBeDefined();
      expect(loadedData.interactions).toHaveLength(1);
      expect(loadedData.interactions[0].command).toBe('HELLO');
    });

    test('should delete recording', async() => {
      // Create a recording
      await recorder.startRecording('localhost', 8080);
      const savedFile = await recorder.stopRecording();
      const filename = path.basename(savedFile);

      // Verify file exists
      let recordings = await recorder.listRecordings();
      expect(recordings).toHaveLength(1);

      // Delete recording
      await recorder.deleteRecording(filename);

      // Verify file is gone
      recordings = await recorder.listRecordings();
      expect(recordings).toHaveLength(0);
    });

    test('should handle missing recordings directory', async() => {
      const nonExistentDir = path.join(__dirname, '../../temp/nonexistent');
      recorder = new SessionRecorder({
        enabled: true,
        recordingsDir: nonExistentDir
      });

      const recordings = await recorder.listRecordings();
      expect(recordings).toHaveLength(0);
    });
  });

  describe('Export Functionality', () => {
    let testSessionData;

    beforeEach(async() => {
      // Create test session data
      await recorder.startRecording('localhost', 8080);
      recorder.recordInteraction({
        type: 'request',
        command: 'HELLO',
        nonce: 0,
        payload: '',
        timestamp: '2023-09-17T10:30:00.000Z'
      });
      recorder.recordInteraction({
        type: 'response',
        command: 'HELLO_ACK',
        nonce: 1,
        payload: '',
        timestamp: '2023-09-17T10:30:00.020Z'
      });
      const savedFile = await recorder.stopRecording();
      testSessionData = path.basename(savedFile);
    });

    test('should export to JSON format', async() => {
      const exported = await recorder.exportRecording(testSessionData, 'json');

      const data = JSON.parse(exported);
      expect(data.metadata).toBeDefined();
      expect(data.interactions).toHaveLength(2);
    });

    test('should export to CSV format', async() => {
      const exported = await recorder.exportRecording(testSessionData, 'csv');

      expect(exported).toContain('Step,Timestamp,Type,Command,Nonce,Payload,Direction');
      expect(exported).toContain('1,');
      expect(exported).toContain('2,');
      expect(exported).toContain('HELLO');
      expect(exported).toContain('HELLO_ACK');
    });

    test('should export to text format', async() => {
      const exported = await recorder.exportRecording(testSessionData, 'txt');

      expect(exported).toContain('Session Recording:');
      expect(exported).toContain('Start Time:');
      expect(exported).toContain('Total Steps: 2');
      expect(exported).toContain('[1] 2023-09-17T10:30:00.000Z client -> server');
      expect(exported).toContain('Command: HELLO');
    });

    test('should handle unsupported export format', async() => {
      // Ensure we have a valid test session file
      expect(testSessionData).toBeDefined();
      expect(testSessionData).not.toBe('.');

      await expect(recorder.exportRecording(testSessionData, 'unsupported'))
        .rejects.toThrow('Unsupported export format: unsupported');
    });

    test('should handle CSV export with special characters', async() => {
      // Create recording with special characters in payload
      await recorder.startRecording('localhost', 8080);
      recorder.recordInteraction({
        type: 'request',
        command: 'DUMP',
        nonce: 2,
        payload: 'payload with "quotes" and, commas',
        timestamp: '2023-09-17T10:30:00.000Z'
      });
      const savedFile = await recorder.stopRecording();

      // Ensure recording was saved successfully
      expect(savedFile).toBeDefined();
      expect(savedFile).not.toBeNull();

      const filename = path.basename(savedFile);

      const exported = await recorder.exportRecording(filename, 'csv');

      // Should properly escape quotes
      expect(exported).toContain('""quotes""');
      expect(exported).toContain('payload with ""quotes"" and, commas');
    });
  });

  describe('Error Handling', () => {
    test('should handle file system errors gracefully', async() => {
      // Try to use invalid directory
      recorder = new SessionRecorder({
        enabled: true,
        recordingsDir: '/invalid/path/that/does/not/exist'
      });

      await expect(recorder.startRecording('localhost', 8080))
        .rejects.toThrow('Failed to create recordings directory');
    });

    test('should handle invalid recording file', async() => {
      // Create invalid JSON file
      const invalidFile = path.join(tempRecordingsDir, 'invalid.json');
      await fs.writeFile(invalidFile, 'invalid json content');

      await expect(recorder.loadRecording('invalid.json'))
        .rejects.toThrow('Failed to load recording');
    });

    test('should handle non-existent file deletion', async() => {
      await expect(recorder.deleteRecording('nonexistent.json'))
        .rejects.toThrow('Failed to delete recording');
    });

    test('should handle auto-save failures gracefully', async() => {
      await recorder.startRecording('localhost', 8080);

      // Mock fs.writeFile to fail
      const originalWriteFile = fs.writeFile;
      fs.writeFile = jest.fn().mockRejectedValue(new Error('Disk full'));

      // This should not throw, but should log error
      recorder.recordInteraction({
        type: 'request',
        command: 'HELLO',
        nonce: 0,
        payload: '',
        timestamp: new Date().toISOString()
      });

      // Wait for auto-save attempt
      await new Promise(resolve => setTimeout(resolve, 50));

      // Restore original function
      fs.writeFile = originalWriteFile;
    });
  });

  describe('Auto-save and Recovery', () => {
    test('should auto-save after each interaction', async() => {
      await recorder.startRecording('localhost', 8080);

      recorder.recordInteraction({
        type: 'request',
        command: 'HELLO',
        nonce: 0,
        payload: '',
        timestamp: new Date().toISOString()
      });

      // Wait for auto-save
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if file was created (auto-save)
      const status = recorder.getStatus();
      const fileExists = await fs.access(status.sessionFile).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Verify content
      const content = await fs.readFile(status.sessionFile, 'utf8');
      const data = JSON.parse(content);
      expect(data.interactions).toHaveLength(1);
    });

    test('should handle recovery from partially saved session', async() => {
      await recorder.startRecording('localhost', 8080);

      // Record interaction and auto-save
      recorder.recordInteraction({
        type: 'request',
        command: 'HELLO',
        nonce: 0,
        payload: '',
        timestamp: new Date().toISOString()
      });

      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for auto-save

      const status = recorder.getStatus();
      const sessionFile = status.sessionFile;

      // Stop recording (this should finalize the file)
      await recorder.stopRecording();

      // Verify final file is complete
      const content = await fs.readFile(sessionFile, 'utf8');
      const data = JSON.parse(content);
      expect(data.metadata.endTime).toBeDefined();
      expect(data.metadata.duration).toBeDefined();
    });
  });
});
