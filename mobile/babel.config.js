module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo replaces @react-native/babel-preset. It also reads the
    // `paths` map out of tsconfig.json, so the old babel-plugin-module-resolver
    // is gone - '@/foo' imports keep working with no extra plugin.
    //
    // It handles .env too: any EXPO_PUBLIC_* variable is inlined at build time,
    // which is why react-native-dotenv and the virtual '@env' module are gone.
    presets: ['babel-preset-expo'],
  };
};
