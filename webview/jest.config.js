/* global module */

module.exports = {
  coverageDirectory: 'coverage/jest',
  coveragePathIgnorePatterns: [
    '<rootDir>/src/test/',
    '/node_modules/',
    '<rootDir>/src/stories/',
    '<rootDir>/src/util/wdyr.ts'
  ],
  coverageReporters: ['json'],
  globals: {
    __webpack_public_path__: true
  },
  moduleNameMapper: {
    '^dvc/(.*)$': '<rootDir>/../extension/$1',
    '\\.(scss|css|less)$': 'identity-obj-proxy'
  },
  setupFiles: ['jest-canvas-mock', '<rootDir>/setup-tests.js'],
  testEnvironment: 'jsdom',
  testTimeout: 20000,
  transform: {
    '\\.py$': '<rootDir>/rawLoaderTransformer.js',
    '^.+\\.(t|j)sx?$': ['@swc/jest']
  }
}
