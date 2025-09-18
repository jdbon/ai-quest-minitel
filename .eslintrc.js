module.exports = {
  env: {
    browser: false,
    commonjs: true,
    es2022: true,
    node: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  overrides: [
    {
      env: {
        node: true
      },
      files: ['.eslintrc.{js,cjs}'],
      parserOptions: {
        sourceType: 'script'
      }
    },
    {
      env: {
        jest: true
      },
      files: ['**/*.test.js', '**/*.spec.js', 'tests/**/*.js']
    }
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'commonjs'
  },
  rules: {
    // Style rules
    'indent': ['error', 2],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],

    // Best practices
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'no-console': 'off', // Allow console.log for this CLI app
    'prefer-const': 'error',
    'no-var': 'error',

    // Node.js specific
    'no-process-exit': 'off', // Allow process.exit in CLI apps
    'handle-callback-err': 'error',
    'no-new-require': 'error',
    'no-path-concat': 'error',

    // General quality rules
    'eqeqeq': 'error',
    'no-trailing-spaces': 'error',
    'no-multiple-empty-lines': ['error', { 'max': 2 }],
    'comma-dangle': ['error', 'never'],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'space-before-function-paren': ['error', 'never'],
    'keyword-spacing': ['error', { 'before': true, 'after': true }],

    // Relaxed rules for this project
    'no-empty': ['error', { 'allowEmptyCatch': true }],
    'no-constant-condition': ['error', { 'checkLoops': false }]
  },
  ignorePatterns: [
    'node_modules/',
    'coverage/',
    'logs/',
    'recordings/',
    '*.min.js',
    'dist/',
    'build/'
  ]
};
