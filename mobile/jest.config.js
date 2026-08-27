module.exports = {
  // jest-expo replaces @react-native/jest-preset: it mocks the expo-* native
  // modules, which the plain RN preset knows nothing about.
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};
