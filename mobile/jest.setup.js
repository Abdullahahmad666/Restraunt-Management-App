/* eslint-env jest */

// Native modules have no JS implementation under Jest, so stub the ones the
// app touches on import.
jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn(() => Promise.resolve(true)),
  getGenericPassword: jest.fn(() => Promise.resolve(false)),
  resetGenericPassword: jest.fn(() => Promise.resolve(true)),
}));

// '@env' is not mocked: react-native-dotenv inlines those values at transform
// time, so under Jest (where there is no .env) src/config/env.ts simply falls
// back to its defaults - which is the behaviour worth testing anyway.
