#!/usr/bin/env node

/**
 * Setup script for MiniTel-Lite Client
 * Creates necessary directories and validates installation
 */

const fs = require('fs').promises;
const path = require('path');

async function createDirectory(dirPath, description) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    console.log(`✅ Created ${description}: ${dirPath}`);
  } catch (error) {
    if (error.code === 'EEXIST') {
      console.log(`📁 ${description} already exists: ${dirPath}`);
    } else {
      console.error(`❌ Failed to create ${description}: ${error.message}`);
      throw error;
    }
  }
}

async function validateFile(filePath, description) {
  try {
    await fs.access(filePath);
    console.log(`✅ ${description} exists: ${filePath}`);
  } catch (error) {
    console.error(`❌ ${description} missing: ${filePath}`);
    throw new Error(`Required file missing: ${filePath}`);
  }
}

async function setup() {
  console.log('🚀 Setting up MiniTel-Lite Client...\n');

  try {
    // Create required directories
    await createDirectory('./logs', 'Logs directory');
    await createDirectory('./recordings', 'Recordings directory');
    
    // Validate core files
    console.log('\n🔍 Validating installation...');
    await validateFile('./src/index.js', 'Main application');
    await validateFile('./src/replay.js', 'Replay application');
    await validateFile('./src/protocol/client.js', 'Protocol client');
    await validateFile('./src/recorder/session-recorder.js', 'Session recorder');
    await validateFile('./package.json', 'Package configuration');

    // Check if dependencies are installed
    try {
      await fs.access('./node_modules');
      console.log('✅ Dependencies installed');
    } catch (error) {
      console.log('⚠️  Dependencies not installed. Run: yarn install');
    }

    console.log('\n🎉 Setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Use correct Node.js version: nvm use');
    console.log('   2. Install dependencies: yarn install');
    console.log('   3. Start the client: yarn start');
    console.log('   4. View recordings: yarn replay');
    console.log('   5. Read the documentation: README.md');

  } catch (error) {
    console.error('\n💥 Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  setup();
}

module.exports = { setup };
