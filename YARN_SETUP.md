# Yarn Setup for MiniTel-Lite Client

## About Yarn

This project has been configured to use [Yarn](https://yarnpkg.com/) as the
package manager instead of npm. Yarn provides faster installs, better
dependency resolution, and improved security features.

## Installation

### Install Yarn (if not already installed)

#### Option 1: Using npm (one-time setup)

```bash
npm install -g yarn
```

#### Option 2: Using corepack (Node.js 16.10+)

```bash
corepack enable
corepack prepare yarn@stable --activate
```

#### Option 3: Using Homebrew (macOS)

```bash
brew install yarn
```

### Verify Installation

```bash
yarn --version
```

## Usage

### Install Dependencies

```bash
yarn install
# or simply
yarn
```

### Run Scripts

```bash
# Start the MiniTel client
yarn start

# Run with options (note: no need for -- with yarn)
yarn start --record --host localhost --port 8080

# Run tests
yarn test
yarn test:unit
yarn test:integration
yarn test:coverage

# Session replay
yarn replay session_file.json

# Development
yarn dev
yarn lint
```

## Key Differences from npm

### Command Syntax

| npm | yarn |
|-----|------|
| `npm install` | `yarn install` or `yarn` |
| `npm start` | `yarn start` |
| `npm run test` | `yarn test` |
| `npm start -- --flag` | `yarn start --flag` |

### Benefits of Yarn

- ⚡ **Faster installs**: Parallel downloads and caching
- 🔒 **Better security**: Automatic integrity checks
- 📦 **Deterministic installs**: Lockfile ensures consistency
- 🎯 **Better workspace support**: Monorepo management
- 🚀 **Modern features**: Built-in support for latest Node.js features

## Migration Notes

### Existing npm Projects

If you have an existing `package-lock.json`, you should:

1. Delete `package-lock.json`
2. Delete `node_modules/`
3. Run `yarn install`

This will create a new `yarn.lock` file.

### Scripts Updated

All scripts in `package.json` and documentation have been updated to use Yarn syntax:

- Test runner now uses `yarn jest` instead of `npx jest`
- Documentation examples use `yarn` commands
- Setup scripts show `yarn install` instructions

## Yarn Scripts Reference

### Application

```bash
yarn start                    # Start MiniTel client
yarn start --record          # Start with recording
yarn dev                     # Development mode with watch
```

### Testing

```bash
yarn test                    # Run all tests
yarn test:unit              # Unit tests only
yarn test:integration       # Integration tests
yarn test:watch             # Watch mode
yarn test:coverage          # With coverage report
yarn test:help              # Show test options
```

### Session Management

```bash
yarn replay <file>          # Replay session
yarn list-recordings        # List available recordings
yarn cleanup-recordings     # Clean old recordings
yarn export-recording <file> <format>  # Export recording
```

### Development

```bash
yarn lint                   # Run ESLint
yarn setup                  # Run setup script
nvm use                    # Use correct Node version (run directly)
```

## Troubleshooting

### Yarn not found

Make sure Yarn is installed globally:

```bash
npm install -g yarn
```

### Permission issues

Use `sudo` if needed on Unix systems:

```bash
sudo npm install -g yarn
```

### Cache issues

Clear Yarn cache if you encounter issues:

```bash
yarn cache clean
```

## Performance Tips

### Enable Yarn Berry (optional)

For even better performance, consider upgrading to Yarn Berry:

```bash
yarn set version berry
```

### Use .yarnrc.yml (optional)

Create a `.yarnrc.yml` file for project-specific Yarn configuration:

```yaml
nodeLinker: node-modules
yarnPath: .yarn/releases/yarn-3.6.3.cjs
```

This setup provides a modern, fast, and reliable development experience for
the MiniTel-Lite client.
