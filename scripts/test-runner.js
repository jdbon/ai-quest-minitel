#!/usr/bin/env node

/**
 * MiniTel Test Runner
 * Comprehensive test execution with reporting and coverage
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class TestRunner {
  constructor() {
    this.testSuites = {
      unit: {
        name: 'Unit Tests',
        pattern: 'tests/unit',
        description: 'Test individual components and functions'
      },
      integration: {
        name: 'Integration Tests',
        pattern: 'tests/integration',
        description: 'Test complete application flows and interactions'
      },
      all: {
        name: 'All Tests',
        pattern: 'tests/',
        description: 'Run complete test suite'
      }
    };
  }

  /**
   * Display available test options
   */
  showHelp() {
    console.log('🧪 MiniTel Test Runner');
    console.log('=====================\n');
    console.log('Usage: yarn test:<suite> [options]');
    console.log('   or: node scripts/test-runner.js <suite> [options]\n');
    
    console.log('Test Suites:');
    Object.entries(this.testSuites).forEach(([key, suite]) => {
      console.log(`  ${key.padEnd(12)} - ${suite.description}`);
    });
    
    console.log('\nOptions:');
    console.log('  --watch        Watch for file changes and re-run tests');
    console.log('  --coverage     Generate code coverage report');
    console.log('  --verbose      Show detailed test output');
    console.log('  --bail         Stop on first test failure');
    console.log('  --help         Show this help message');
    
    console.log('\nExamples:');
    console.log('  yarn test:unit');
    console.log('  yarn test:integration --coverage');
    console.log('  yarn test --watch');
    console.log('  node scripts/test-runner.js unit --verbose');
  }

  /**
   * Parse command line arguments
   * @param {Array} args - Command line arguments
   * @returns {Object} Parsed options
   */
  parseArgs(args) {
    const options = {
      suite: 'all',
      watch: false,
      coverage: false,
      verbose: false,
      bail: false,
      help: false
    };

    // First non-flag argument is the test suite
    const suiteArg = args.find(arg => !arg.startsWith('--'));
    if (suiteArg && this.testSuites[suiteArg]) {
      options.suite = suiteArg;
    }

    // Parse flags
    if (args.includes('--watch')) options.watch = true;
    if (args.includes('--coverage')) options.coverage = true;
    if (args.includes('--verbose')) options.verbose = true;
    if (args.includes('--bail')) options.bail = true;
    if (args.includes('--help')) options.help = true;

    return options;
  }

  /**
   * Build Jest command arguments
   * @param {Object} options - Test options
   * @returns {Array} Jest arguments
   */
  buildJestArgs(options) {
    const args = [];
    const suite = this.testSuites[options.suite];
    
    // Test pattern
    args.push(suite.pattern);
    
    // Options
    if (options.watch) args.push('--watch');
    if (options.coverage) args.push('--coverage');
    if (options.verbose) args.push('--verbose');
    if (options.bail) args.push('--bail');
    
    // Force colors in CI
    args.push('--colors');
    
    // Set test timeout
    args.push('--testTimeout', '15000');
    
    return args;
  }

  /**
   * Run tests with the specified options
   * @param {Object} options - Test options
   * @returns {Promise<number>} Exit code
   */
  async runTests(options) {
    const suite = this.testSuites[options.suite];
    
    console.log(`🚀 Running ${suite.name}`);
    console.log(`📁 Pattern: ${suite.pattern}`);
    console.log(`📋 Description: ${suite.description}\n`);

    // Build Jest command
    const jestArgs = this.buildJestArgs(options);
    
    // Environment variables
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      LOG_LEVEL: 'error'
    };

    if (options.verbose) {
      env.JEST_VERBOSE = 'true';
    }

    return new Promise((resolve) => {
      const jest = spawn('yarn', ['jest', ...jestArgs], {
        stdio: 'inherit',
        env
      });

      jest.on('close', (code) => {
        resolve(code);
      });

      jest.on('error', (error) => {
        console.error('❌ Failed to start Jest:', error.message);
        resolve(1);
      });
    });
  }

  /**
   * Check test environment and dependencies
   * @returns {Promise<boolean>} True if environment is ready
   */
  async checkEnvironment() {
    try {
      // Check if Jest is available via yarn
      await this.runCommand('yarn', ['jest', '--version']);
      
      // Check if test directories exist
      const testDir = path.join(process.cwd(), 'tests');
      await fs.access(testDir);
      
      return true;
    } catch (error) {
      console.error('❌ Test environment not ready:');
      console.error('   - Make sure dependencies are installed: yarn install');
      console.error('   - Ensure tests directory exists');
      return false;
    }
  }

  /**
   * Run a command and return output
   * @param {string} command - Command to run
   * @param {Array} args - Command arguments
   * @returns {Promise<string>} Command output
   */
  runCommand(command, args) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: 'pipe' });
      let output = '';
      
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Command failed with code ${code}`));
        }
      });
      
      child.on('error', reject);
    });
  }

  /**
   * Display test results summary
   * @param {number} exitCode - Jest exit code
   * @param {Object} options - Test options
   */
  showResults(exitCode, options) {
    console.log('\n' + '='.repeat(50));
    
    if (exitCode === 0) {
      console.log('✅ All tests passed!');
    } else {
      console.log('❌ Some tests failed.');
    }
    
    if (options.coverage) {
      console.log('📊 Coverage report generated in coverage/ directory');
      console.log('   Open coverage/lcov-report/index.html to view detailed report');
    }
    
    console.log('='.repeat(50));
  }

  /**
   * Main execution function
   * @param {Array} args - Command line arguments
   */
  async run(args) {
    const options = this.parseArgs(args);
    
    if (options.help) {
      this.showHelp();
      return 0;
    }

    // Check environment
    const envReady = await this.checkEnvironment();
    if (!envReady) {
      return 1;
    }

    // Run tests
    const exitCode = await this.runTests(options);
    
    // Show results
    this.showResults(exitCode, options);
    
    return exitCode;
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new TestRunner();
  const args = process.argv.slice(2);
  
  runner.run(args).then((exitCode) => {
    process.exit(exitCode);
  }).catch((error) => {
    console.error('💥 Test runner error:', error.message);
    process.exit(1);
  });
}

module.exports = TestRunner;
