#!/usr/bin/env node

/**
 * MiniTel-Lite Protocol Client
 * Main entry point
 */

// Load environment variables from .env files
require('dotenv').config(); // Load .env
require('dotenv').config({ path: '.env.local' }); // Load .env.local (overrides .env)

const MiniTelApplication = require('./client/application');
const { parseArguments, validateConfig, displayConfig } = require('./utils/config');
const { logger } = require('./utils/logger');

async function main() {
  try {
    console.log('🔌 MiniTel-Lite Protocol Client v1.0.0');
    console.log('=====================================\n');

    // Parse command-line arguments
    const args = parseArguments();

    // Validate configuration
    const config = validateConfig(args);

    // Set log level
    process.env.LOG_LEVEL = config.logLevel;

    // Display configuration
    displayConfig(config);

    // Create and configure application
    const app = new MiniTelApplication(config);

    // Setup graceful shutdown handlers
    app.setupGracefulShutdown();

    // Start the application
    await app.start();

  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    logger.error('Fatal application error', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Handle CLI help and errors
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { main };
