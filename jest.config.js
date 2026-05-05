module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js', // Server startup is tested via integration tests
    '!src/config/logger.js', // Logging is tested implicitly
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testMatch: [
    '**/tests/**/*.test.js',
  ],
  transform: {},
  moduleDirectories: ['node_modules'],
  roots: ['<rootDir>'],
  setupFilesAfterEnv: [],
  verbose: true,
  maxWorkers: '50%',
  testTimeout: 10000,
  errorOnDeprecated: true,
  moduleNameMapper: {},
};
