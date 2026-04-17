/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  forceExit: true,
  detectOpenHandles: true,
  testTimeout: 30000,
  coverageDirectory: '/tmp/coverage',
  coverageReporters: ['text', 'text-summary', 'json-summary'],
  collectCoverageFrom: [
    '/app/dist/**/*.js',
    '!**/node_modules/**',
    '!**/dist/server.js',
  ],
  // Coverage thresholds reflect actual measured coverage from the API test suite.
  // Gated at 5% below measured to allow normal fluctuation without regression leeway.
  coverageThreshold: {
    global: {
      statements: 50,
      branches: 65,
      functions: 45,
      lines: 50,
    },
  },
};
