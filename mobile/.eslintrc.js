module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    'no-console': ['warn', {allow: ['warn', 'error']}],
  },
  ignorePatterns: ['node_modules/', 'android/', 'ios/', 'coverage/'],
};
