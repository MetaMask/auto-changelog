module.exports = {
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.js', '!\\.test\\.js$'],
  coverageReporters: ['text', 'html'],
  moduleFileExtensions: ['js', 'json', 'jsx', 'ts', 'tsx', 'node'],
  testEnvironment: 'node',
  testRegex: ['\\.test\\.js$'],
  testTimeout: 5000,
};
