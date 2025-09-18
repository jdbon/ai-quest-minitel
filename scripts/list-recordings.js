#!/usr/bin/env node

/**
 * Utility script to list and manage session recordings
 */

const SessionRecorder = require('../src/recorder/session-recorder');
const path = require('path');
const fs = require('fs').promises;

async function listRecordings(recordingsDir = './recordings') {
  try {
    console.log('📼 MiniTel Session Recordings');
    console.log('============================\n');

    const recorder = new SessionRecorder({ recordingsDir });
    const recordings = await recorder.listRecordings();

    if (recordings.length === 0) {
      console.log('No recordings found in:', path.resolve(recordingsDir));
      console.log('\nTo create recordings, run the client with --record flag:');
      console.log('  yarn start --record');
      return;
    }

    console.log(`Found ${recordings.length} recording${recordings.length > 1 ? 's' : ''}:\n`);

    recordings.forEach((recording, index) => {
      const startTime = new Date(recording.startTime).toLocaleString();
      const endTime = recording.endTime ? new Date(recording.endTime).toLocaleString() : 'N/A';
      const duration = recording.endTime 
        ? Math.round((new Date(recording.endTime) - new Date(recording.startTime)) / 1000)
        : 'N/A';
      
      console.log(`${index + 1}. ${recording.filename}`);
      console.log(`   Session ID: ${recording.sessionId}`);
      console.log(`   Server: ${recording.serverHost}:${recording.serverPort}`);
      console.log(`   Started: ${startTime}`);
      console.log(`   Ended: ${endTime}`);
      console.log(`   Duration: ${duration}s`);
      console.log(`   Steps: ${recording.totalSteps}`);
      console.log(`   File Size: ${formatBytes(recording.fileSize)}`);
      console.log('');
    });

    console.log('Usage Examples:');
    console.log(`  yarn replay ${recordings[0].filename}`);
    console.log(`  yarn replay ${recordings[0].filename} --auto-play`);

  } catch (error) {
    console.error('❌ Error listing recordings:', error.message);
    process.exit(1);
  }
}

async function cleanupRecordings(recordingsDir = './recordings', daysOld = 30) {
  try {
    console.log(`🧹 Cleaning up recordings older than ${daysOld} days...\n`);

    const recorder = new SessionRecorder({ recordingsDir });
    const recordings = await recorder.listRecordings();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let deletedCount = 0;
    let totalSize = 0;

    for (const recording of recordings) {
      const recordingDate = new Date(recording.startTime);
      
      if (recordingDate < cutoffDate) {
        console.log(`Deleting: ${recording.filename} (${recordingDate.toLocaleDateString()})`);
        
        try {
          await recorder.deleteRecording(recording.filename);
          deletedCount++;
          totalSize += recording.fileSize;
        } catch (error) {
          console.error(`  Failed to delete: ${error.message}`);
        }
      }
    }

    console.log(`\n✅ Cleanup completed:`);
    console.log(`   Deleted ${deletedCount} recording${deletedCount !== 1 ? 's' : ''}`);
    console.log(`   Freed ${formatBytes(totalSize)} of disk space`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    process.exit(1);
  }
}

async function exportRecording(filename, format = 'json', recordingsDir = './recordings') {
  try {
    console.log(`📤 Exporting recording: ${filename}`);
    console.log(`Format: ${format.toUpperCase()}\n`);

    const recorder = new SessionRecorder({ recordingsDir });
    const exportedContent = await recorder.exportRecording(filename, format);

    // Write to output file
    const baseName = path.basename(filename, '.json');
    const outputFile = `${baseName}.${format}`;
    
    await fs.writeFile(outputFile, exportedContent, 'utf8');
    
    console.log(`✅ Exported to: ${outputFile}`);
    console.log(`   Size: ${formatBytes(Buffer.byteLength(exportedContent, 'utf8'))}`);

  } catch (error) {
    console.error('❌ Export failed:', error.message);
    process.exit(1);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showUsage() {
  console.log('Usage:');
  console.log('  node scripts/list-recordings.js [command] [options]');
  console.log('');
  console.log('Commands:');
  console.log('  list                    List all recordings (default)');
  console.log('  cleanup [days]          Delete recordings older than X days (default: 30)');
  console.log('  export <file> [format]  Export recording to different format');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/list-recordings.js');
  console.log('  node scripts/list-recordings.js cleanup 7');
  console.log('  node scripts/list-recordings.js export session_abc123.json csv');
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'list';

  switch (command) {
    case 'list':
      await listRecordings(args[1]);
      break;

    case 'cleanup':
      const days = parseInt(args[1]) || 30;
      await cleanupRecordings(args[2], days);
      break;

    case 'export':
      if (!args[1]) {
        console.error('❌ Error: Filename required for export');
        showUsage();
        process.exit(1);
      }
      await exportRecording(args[1], args[2] || 'json', args[3]);
      break;

    case 'help':
    case '--help':
    case '-h':
      showUsage();
      break;

    default:
      console.error(`❌ Unknown command: ${command}`);
      showUsage();
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = {
  listRecordings,
  cleanupRecordings,
  exportRecording
};
