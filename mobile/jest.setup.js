/* eslint-env jest */

// jest-expo mocks the expo-* native modules for us, but not the behaviour we
// depend on, so stub the two calls tokenStorage makes.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    setItemAsync: jest.fn(async (key, value) => {
      store.set(key, value);
    }),
    getItemAsync: jest.fn(async key => (store.has(key) ? store.get(key) : null)),
    deleteItemAsync: jest.fn(async key => {
      store.delete(key);
    }),
    __store: store,
  };
});
