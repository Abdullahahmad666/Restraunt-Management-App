module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Makes `import {API_BASE_URL} from '@env'` read mobile/.env at build time.
    // React Native has no process.env loader of its own - without this the
    // values in .env would simply be undefined at runtime.
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        safe: false,
        allowUndefined: true,
      },
    ],
    // Keeps '@/foo' imports working. Must stay last.
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {'@': './src'},
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      },
    ],
  ],
};
