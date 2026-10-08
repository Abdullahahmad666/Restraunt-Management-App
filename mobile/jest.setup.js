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

// @expo/vector-icons reaches expo-font, which reaches expo-asset - a package
// nothing in this app depends on directly, so it is not installed and any test
// that renders a screen with an icon in it dies on the import rather than on
// anything it meant to check. The icons are glyphs with nothing to assert on,
// so stand every set in that module up as a plain Text of its icon name.
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const {Text} = require('react-native');
  const Icon = ({name, ...rest}) => React.createElement(Text, rest, name);
  return new Proxy({__esModule: true}, {get: (target, key) => target[key] ?? Icon});
});
