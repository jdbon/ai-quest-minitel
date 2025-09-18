/**
 * Server Configuration for MiniTel-Lite Client
 *
 * This file contains the default server configuration.
 * These values can be overridden by:
 * 1. Environment variables (SERVER_HOST, SERVER_PORT)
 * 2. Command-line arguments (--host, --port)
 */

// Default MiniTel-Lite Server Configuration
// Note: Use environment variables for sensitive server details
const DEFAULT_SERVER = {
  HOST: 'localhost',
  PORT: 8080
};

// Alternative server configurations for different environments
const SERVER_CONFIGS = {
  // Production server (configured via environment variables)
  production: {
    host: process.env.SERVER_HOST || 'production.server.com',
    port: parseInt(process.env.SERVER_PORT) || 8080,
    timeout: parseInt(process.env.CONNECTION_TIMEOUT) || 5000,
    maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 5,
    reconnectDelay: parseInt(process.env.RECONNECT_DELAY) || 2000
  },

  // Development/local server
  development: {
    host: 'localhost',
    port: 8080,
    timeout: 10000,
    maxReconnectAttempts: 1,
    reconnectDelay: 500
  },

  // Testing server
  testing: {
    host: '127.0.0.1',
    port: 8081,
    timeout: 1000,
    maxReconnectAttempts: 0,
    reconnectDelay: 0
  }
};

/**
 * Get server configuration for specified environment
 * @param {string} env - Environment name (production, development, testing)
 * @returns {Object} Server configuration
 */
function getServerConfig(env = 'production') {
  return SERVER_CONFIGS[env] || SERVER_CONFIGS.production;
}

/**
 * Get server configuration from environment variables with fallbacks
 * @returns {Object} Server configuration
 */
function getServerConfigFromEnv() {
  return {
    host: process.env.SERVER_HOST || DEFAULT_SERVER.HOST,
    port: parseInt(process.env.SERVER_PORT) || DEFAULT_SERVER.PORT,
    timeout: parseInt(process.env.CONNECTION_TIMEOUT) || 2000,
    maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 3,
    reconnectDelay: parseInt(process.env.RECONNECT_DELAY) || 1000
  };
}

module.exports = {
  DEFAULT_SERVER,
  SERVER_CONFIGS,
  getServerConfig,
  getServerConfigFromEnv
};
