export default {
  testEnvironment: 'node',
  transform: {}, // Disable transforms if using native ESM
  verbose: true,
  testTimeout: 30000,
  // Make sure Jest handles ESM imports correctly
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};