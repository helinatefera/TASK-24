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
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 75,
      functions: 80,
      lines: 85,
    },
  },
};
