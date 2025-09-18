/**
 * Jest Global Teardown - Runs once after all tests
 */

const fs = require('fs').promises;
const path = require('path');

module.exports = async() => {
  // Clean up test directories
  try {
    const tempDir = path.join(process.cwd(), 'tests', 'temp');
    await fs.rmdir(tempDir, { recursive: true });
  } catch (error) {
    // Directory might not exist or might not be empty
  }

  console.log('🧹 Test environment cleaned up');
};
