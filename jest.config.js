module.exports = {
  collectCoverage: true,
  collectCoverageFrom: ['./src/**.ts'],
  // Jest (i.e. istanbul) identifies every export in index.ts as a distinct
  // function, which tanks our function coverage.
  coveragePathIgnorePatterns: ['index.ts'],
  coverageReporters: ['text', 'html'],
  coverageThreshold: {
    global: {
      branches: 45,
      functions: 55,
      lines: 40,
      statements: 40,
    },
  },
  moduleFileExtensions: ['js', 'json', 'jsx', 'ts', 'tsx', 'node'],
  preset: 'ts-jest',
  // "resetMocks" resets all mocks, including mocked modules, to jest.fn(),
  // between each test case.
  resetMocks: true,
  // "restoreMocks" restores all mocks created using jest.spyOn to their
  // original implementations, between each test. It does not affect mocked
  // modules.
  restoreMocks: true,
  testEnvironment: 'node',
  testRegex: ['\\.test\\.(ts|js)$'],
  testTimeout: 2500,
};
