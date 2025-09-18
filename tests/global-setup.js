/**
 * Jest Global Setup - Runs once before all tests
 */

const fs = require('fs').promises;

module.exports = async() => {
  // Create test directories
  const testDirs = [
    'tests/temp',
    'tests/temp/recordings',
    'tests/temp/logs'
  ];

  for (const dir of testDirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';

  console.log('🧪 Test environment initialized');
};
