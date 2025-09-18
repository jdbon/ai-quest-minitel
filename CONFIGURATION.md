# MiniTel-Lite Client Configuration Guide

## Prerequisites

### Node.js Version

This project requires **Node.js 18 or higher**. The `.nvmrc` file specifies
Node.js 18 (LTS).

If using [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install  # Install Node.js 18
nvm use      # Use the version specified in .nvmrc
```

## Server Configuration

The MiniTel client uses **environment variables** for secure server configuration:

- **Default Host:** `localhost` (development fallback)
- **Default Port:** `8080` (development fallback)
- **Production:** Configured via `.env` file

## Configuration Methods

### 1. Default Configuration (Recommended)

Simply run the client without any arguments to connect to the default server:

```bash
yarn start
```

### 2. Environment Variables

#### Local Development Setup (Recommended)

For local development with actual server credentials:

```bash
# Copy the template for local development
cp env.example .env.local
# Edit .env.local with your actual server credentials
# SERVER_HOST=your.server.com
# SERVER_PORT=XXXX

yarn start
```

**Why `.env.local`?**

- ✅ **Automatically gitignored** - prevents credential leaks
- ✅ **Local overrides** - takes precedence over `.env`
- ✅ **Industry standard** - follows best practices
- ✅ **Development optimized** - can include debug settings

#### Alternative: Traditional `.env` Setup

```bash
# Copy the template  
cp env.example .env
# Edit .env with your server details
# Note: .env is also gitignored but .env.local is preferred
```

#### Available Environment Variables

- `SERVER_HOST` - Server hostname
- `SERVER_PORT` - Server port number
- `LOG_LEVEL` - Logging level (error, warn, info, debug)
- `CONNECTION_TIMEOUT` - Connection timeout in milliseconds
- `MAX_RECONNECT_ATTEMPTS` - Maximum reconnection attempts
- `RECONNECT_DELAY` - Delay between reconnection attempts

### 3. Command Line Arguments

Override any setting using command line arguments:

```bash
# Connect to different server
yarn start --host localhost --port 8080

# Enable recording with default server
yarn start --record

# Full customization with command line overrides
yarn start --host your.server.com --port 8080 --record --log-level debug
```

## Server Configurations

### Production Server (Default)

```bash
Host: Configured via environment variables
Port: Configured via environment variables  
Usage: yarn start (after configuring .env)
```

### Local Development

```bash
Host: localhost  
Port: 8080
Usage: yarn start --host localhost --port 8080
```

### Custom Server

```bash
Usage: yarn start --host <your-host> --port <your-port>
```

## Quick Examples

```bash
# Connect to default production server
yarn start

# Connect with recording enabled
yarn start --record

# Connect to local development server
yarn start --host localhost --port 8080

# Connect with debug logging
yarn start --log-level debug

# Full production setup with recording
yarn start --record --log-level warn
```

## Configuration Files

- `src/utils/config.js` - Main configuration management
- `config/server.config.js` - Server-specific configurations
- `examples/config.example.js` - Configuration examples

## Troubleshooting

If you need to connect to a different server temporarily:

```bash
yarn start --host your-server.com --port 9090
```

If you want to change the permanent defaults, modify the values in
`src/utils/config.js` or set environment variables in your shell profile.
