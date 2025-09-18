#!/usr/bin/env node

/**
 * MiniTel Session Replay Application
 * Main entry point for the TUI replay system
 */

const path = require('path');
const fs = require('fs').promises;
const TUIPlayer = require('./replay/tui-player');
const SessionRecorder = require('./recorder/session-recorder');
const { parseReplayArguments } = require('./utils/config');

async function main() {
  try {
    console.log('🎬 MiniTel Session Replay v1.0.0');
    console.log('=================================\n');

    // Parse command-line arguments
    const args = parseReplayArguments();

    if (!args.file) {
      console.error('❌ Error: No recording file specified');
      console.log('\nAvailable recordings:');
      await listAvailableRecordings(args.recordingsDir);
      process.exit(1);
    }

    // Resolve recording file path
    let recordingFile = args.file;
    if (!path.isAbsolute(recordingFile)) {
      recordingFile = path.join(args.recordingsDir, recordingFile);
    }

    // Check if file exists
    try {
      await fs.access(recordingFile);
    } catch (error) {
      console.error(`❌ Error: Recording file not found: ${recordingFile}`);
      console.log('\nAvailable recordings:');
      await listAvailableRecordings(args.recordingsDir);
      process.exit(1);
    }

    // Load session data
    console.log(`📂 Loading recording: ${path.basename(recordingFile)}`);
    let sessionData;
    try {
      const content = await fs.readFile(recordingFile, 'utf8');
      sessionData = JSON.parse(content);
    } catch (error) {
      console.error(`❌ Error loading recording: ${error.message}`);
      process.exit(1);
    }

    // Validate session data
    if (!validateSessionData(sessionData)) {
      console.error('❌ Error: Invalid recording file format');
      process.exit(1);
    }

    // Display session information
    displaySessionInfo(sessionData);

    // Initialize TUI player
    const playerOptions = {
      autoPlay: args.autoPlay,
      autoPlayDelay: args.autoPlayDelay
    };

    const player = new TUIPlayer(sessionData, playerOptions);

    console.log('\n🚀 Starting TUI player...');
    console.log('💡 Press H for help, Q to quit\n');

    // Give user a moment to read the message
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Start the TUI
    player.start();

  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Display session information
 * @param {Object} sessionData - Session data
 */
function displaySessionInfo(sessionData) {
  const metadata = sessionData.metadata;
  const startTime = new Date(metadata.startTime).toLocaleString();
  const endTime = metadata.endTime ? new Date(metadata.endTime).toLocaleString() : 'N/A';

  console.log('\n📋 Session Information:');
  console.log(`   Session ID: ${metadata.sessionId}`);
  console.log(`   Server: ${metadata.serverHost}:${metadata.serverPort}`);
  console.log(`   Started: ${startTime}`);
  console.log(`   Ended: ${endTime}`);
  console.log(`   Protocol Version: ${metadata.protocolVersion}`);
  console.log(`   Total Interactions: ${metadata.totalSteps}`);

  if (metadata.duration) {
    const durationSeconds = Math.round(metadata.duration / 1000);
    console.log(`   Duration: ${durationSeconds}s`);
  }
}

/**
 * Validate session data structure
 * @param {Object} sessionData - Session data to validate
 * @returns {boolean} True if valid
 */
function validateSessionData(sessionData) {
  // Check required top-level properties
  if (!sessionData || typeof sessionData !== 'object') {
    return false;
  }

  if (!sessionData.metadata || !sessionData.interactions) {
    return false;
  }

  // Check metadata
  const metadata = sessionData.metadata;
  if (!metadata.sessionId || !metadata.startTime || typeof metadata.totalSteps !== 'number') {
    return false;
  }

  // Check interactions array
  if (!Array.isArray(sessionData.interactions)) {
    return false;
  }

  // Validate each interaction
  for (const interaction of sessionData.interactions) {
    if (!interaction.stepNumber || !interaction.timestamp || !interaction.type || !interaction.command) {
      return false;
    }

    if (interaction.type !== 'request' && interaction.type !== 'response') {
      return false;
    }

    if (typeof interaction.nonce !== 'number') {
      return false;
    }
  }

  return true;
}

/**
 * List available recordings in the recordings directory
 * @param {string} recordingsDir - Recordings directory path
 */
async function listAvailableRecordings(recordingsDir) {
  try {
    const recorder = new SessionRecorder({ recordingsDir });
    const recordings = await recorder.listRecordings();

    if (recordings.length === 0) {
      console.log('   No recordings found in:', recordingsDir);
      return;
    }

    console.log('   Available recordings:');
    recordings.forEach((recording, index) => {
      const startTime = new Date(recording.startTime).toLocaleString();
      console.log(`   ${index + 1}. ${recording.filename}`);
      console.log(`      Server: ${recording.serverHost}:${recording.serverPort}`);
      console.log(`      Date: ${startTime}`);
      console.log(`      Steps: ${recording.totalSteps}`);
      console.log('');
    });

    console.log('Usage examples:');
    console.log(`   ${process.argv[1]} ${recordings[0].filename}`);
    console.log(`   ${process.argv[1]} ${recordings[0].filename} --auto-play`);

  } catch (error) {
    console.log('   Error listing recordings:', error.message);
  }
}

/**
 * Show help if no arguments provided
 */
function showUsageHelp() {
  console.log('Usage:');
  console.log('  minitel-replay <recording-file> [options]');
  console.log('  minitel-replay session_2023-09-17T10-30-00-123Z_abcd1234.json');
  console.log('');
  console.log('Options:');
  console.log('  --auto-play              Enable auto-play mode');
  console.log('  --auto-play-delay <ms>   Delay between steps (default: 1000ms)');
  console.log('  --recordings-dir <path>  Recordings directory (default: ./recordings)');
  console.log('  --help                   Show help');
  console.log('');
  console.log('Controls (in TUI):');
  console.log('  N/n, →, Space  - Next step');
  console.log('  P/p, ←         - Previous step');
  console.log('  A              - Toggle auto-play');
  console.log('  H/?            - Help');
  console.log('  Q              - Quit');
}

// Handle CLI execution
if (require.main === module) {
  // Check if help requested or no args
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showUsageHelp();
    process.exit(0);
  }

  main().catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { main };
