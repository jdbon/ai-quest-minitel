/**
 * Configuration management for MiniTel Client
 */

const yargs = require('yargs');
const path = require('path');

/**
 * Parse command-line arguments
 * @returns {Object} Parsed configuration
 */
function parseArguments() {
  return yargs
    .usage('Usage: $0 [options]')
    .option('host', {
      alias: 'h',
      type: 'string',
      default: process.env.SERVER_HOST || 'localhost',
      description: 'Server hostname'
    })
    .option('port', {
      alias: 'p',
      type: 'number',
      default: parseInt(process.env.SERVER_PORT) || 8080,
      description: 'Server port number'
    })
    .option('timeout', {
      alias: 't',
      type: 'number',
      default: 2000,
      description: 'Connection timeout in milliseconds'
    })
    .option('record', {
      alias: 'r',
      type: 'boolean',
      default: false,
      description: 'Enable session recording'
    })
    .option('recordings-dir', {
      type: 'string',
      default: path.join(process.cwd(), 'recordings'),
      description: 'Directory to store session recordings'
    })
    .option('log-level', {
      type: 'string',
      choices: ['error', 'warn', 'info', 'debug'],
      default: 'info',
      description: 'Logging level'
    })
    .option('auto-reconnect', {
      type: 'boolean',
      default: true,
      description: 'Automatically attempt to reconnect on disconnection'
    })
    .option('max-reconnect-attempts', {
      type: 'number',
      default: 3,
      description: 'Maximum number of reconnection attempts'
    })
    .option('reconnect-delay', {
      type: 'number',
      default: 1000,
      description: 'Delay between reconnection attempts (milliseconds)'
    })
    .option('interactive', {
      alias: 'i',
      type: 'boolean',
      default: false,
      description: 'Start in interactive mode instead of automatic execution'
    })
    .help('help')
    .alias('help', '?')
    .example('$0 --record', 'Connect to default server with recording enabled')
    .example('$0 --host localhost --port 8080 --log-level debug', 'Connect to local server with debug logging')
    .example('$0 --interactive', 'Start in interactive mode for manual command control')
    .argv;
}

/**
 * Parse replay command-line arguments
 * @returns {Object} Parsed replay configuration
 */
function parseReplayArguments() {
  return yargs
    .usage('Usage: $0 <recording-file> [options]')
    .command('$0 <file>', 'Replay a session recording', (yargs) => {
      yargs.positional('file', {
        describe: 'Recording file to replay',
        type: 'string'
      });
    })
    .option('recordings-dir', {
      type: 'string',
      default: path.join(process.cwd(), 'recordings'),
      description: 'Directory containing session recordings'
    })
    .option('auto-play', {
      type: 'boolean',
      default: false,
      description: 'Automatically advance through steps'
    })
    .option('auto-play-delay', {
      type: 'number',
      default: 1000,
      description: 'Delay between auto-play steps (milliseconds)'
    })
    .help('help')
    .alias('help', '?')
    .example('$0 session_2023-09-17T10-30-00-123Z_abcd1234.json', 'Replay a specific session')
    .example('$0 session_latest.json --auto-play --auto-play-delay 2000', 'Auto-replay with 2s delays')
    .argv;
}

/**
 * Validate configuration
 * @param {Object} config - Configuration to validate
 * @returns {Object} Validated configuration
 */
function validateConfig(config) {
  const validated = { ...config };

  // Validate host
  if (!config.host || typeof config.host !== 'string') {
    throw new Error('Invalid host specified');
  }

  // Validate port
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error('Invalid port specified (must be 1-65535)');
  }

  // Validate timeout
  if (!Number.isInteger(config.timeout) || config.timeout < 100) {
    throw new Error('Invalid timeout specified (minimum 100ms)');
  }

  // Validate recordings directory
  if (!config.recordingsDir || typeof config.recordingsDir !== 'string') {
    validated.recordingsDir = path.join(process.cwd(), 'recordings');
  } else {
    validated.recordingsDir = path.resolve(config.recordingsDir);
  }

  // Validate log level
  const validLogLevels = ['error', 'warn', 'info', 'debug'];
  if (config.logLevel && !validLogLevels.includes(config.logLevel)) {
    throw new Error('Invalid log level specified (must be error, warn, info, or debug)');
  }

  // Validate reconnection settings
  if (config.maxReconnectAttempts !== undefined && (!Number.isInteger(config.maxReconnectAttempts) || config.maxReconnectAttempts < 0)) {
    throw new Error('Invalid max reconnect attempts specified (must be non-negative integer)');
  }

  if (config.reconnectDelay !== undefined && (!Number.isInteger(config.reconnectDelay) || config.reconnectDelay < 0)) {
    throw new Error('Invalid reconnect delay specified (must be non-negative integer)');
  }

  // Normalize string boolean values
  if (typeof validated.record === 'string') {
    validated.record = validated.record === 'true' || validated.record === '1';
  }
  if (typeof validated.interactive === 'string') {
    validated.interactive = validated.interactive === 'true' || validated.interactive === '1';
  }
  if (typeof validated.autoReconnect === 'string') {
    validated.autoReconnect = validated.autoReconnect === 'true' || validated.autoReconnect === '1';
  }

  return validated;
}

/**
 * Get default configuration
 * @returns {Object} Default configuration
 */
function getDefaultConfig() {
  return {
    host: process.env.SERVER_HOST || 'localhost',
    port: parseInt(process.env.SERVER_PORT) || 8080,
    timeout: parseInt(process.env.CONNECTION_TIMEOUT) || 2000,
    record: false,
    recordingsDir: process.env.RECORDINGS_DIR || path.join(process.cwd(), 'recordings'),
    logLevel: process.env.LOG_LEVEL || 'info',
    interactive: false,
    autoReconnect: true,
    maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 3,
    reconnectDelay: parseInt(process.env.RECONNECT_DELAY) || 1000
  };
}

/**
 * Merge configurations with precedence
 * @param {...Object} configs - Configurations to merge (later takes precedence)
 * @returns {Object} Merged configuration
 */
function mergeConfigs(...configs) {
  return Object.assign({}, ...configs);
}

/**
 * Display configuration summary
 * @param {Object} config - Configuration to display
 */
function displayConfig(config) {
  console.log('\n📋 Configuration Summary:');
  console.log(`   Server: ${config.host}:${config.port}`);
  console.log(`   Timeout: ${config.timeout}ms`);
  console.log(`   Recording: ${config.record ? '✅ Enabled' : '❌ Disabled'}`);
  if (config.record) {
    console.log(`   Recordings Directory: ${config.recordingsDir}`);
  }
  console.log(`   Log Level: ${config.logLevel}`);
  console.log(`   Auto Reconnect: ${config.autoReconnect ? '✅ Enabled' : '❌ Disabled'}`);
  if (config.autoReconnect) {
    console.log(`   Max Reconnect Attempts: ${config.maxReconnectAttempts}`);
    console.log(`   Reconnect Delay: ${config.reconnectDelay}ms`);
  }
  console.log('');
}

module.exports = {
  parseArguments,
  parseReplayArguments,
  validateConfig,
  getDefaultConfig,
  mergeConfigs,
  displayConfig
};
