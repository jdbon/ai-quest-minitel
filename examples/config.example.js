/**
 * Example configuration file for MiniTel-Lite Client
 * This file demonstrates various configuration options
 */

// Basic connection configuration
const basicConfig = {
  host: 'localhost',
  port: 8080,
  timeout: 2000,
  record: false,
  logLevel: 'info'
};

// Production configuration with recording
// Note: Use environment variables for production server details
const productionConfig = {
  host: process.env.SERVER_HOST || 'production.server.com',
  port: parseInt(process.env.SERVER_PORT) || 8080,
  timeout: parseInt(process.env.CONNECTION_TIMEOUT) || 5000,
  record: true,
  recordingsDir: process.env.RECORDINGS_DIR || '/var/log/minitel-recordings',
  logLevel: process.env.LOG_LEVEL || 'warn',
  autoReconnect: true,
  maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 5,
  reconnectDelay: parseInt(process.env.RECONNECT_DELAY) || 2000
};

// Development configuration with debug logging
const developmentConfig = {
  host: 'dev-server.local',
  port: 8080,
  timeout: 10000, // Longer timeout for debugging
  record: true,
  recordingsDir: './dev-recordings',
  logLevel: 'debug',
  autoReconnect: true,
  maxReconnectAttempts: 1, // Don't retry much in development
  reconnectDelay: 500
};

// Testing configuration
const testConfig = {
  host: '127.0.0.1',
  port: 8081,
  timeout: 1000,
  record: true,
  recordingsDir: './test-recordings',
  logLevel: 'info',
  autoReconnect: false, // Don't reconnect during tests
  maxReconnectAttempts: 0,
  reconnectDelay: 0
};

// Export configurations
module.exports = {
  basicConfig,
  productionConfig,
  developmentConfig,
  testConfig
};

// Usage examples:
//
// 1. Basic usage (uses environment variables or defaults):
//    yarn start
//
// 2. With recording:
//    yarn start --record
//
// 3. Debug mode:
//    yarn start --log-level debug --timeout 10000
//
// 4. Override server:
//    yarn start --host localhost --port 8080 --log-level debug
//
// 5. Full production example:
//    yarn start --record --recordings-dir /var/log/sessions --log-level warn --max-reconnect-attempts 5
//
// 6. Using environment variables:
//    SERVER_HOST=your.server.com SERVER_PORT=XXXX yarn start
