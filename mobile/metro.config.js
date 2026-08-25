// Expo's Metro config, not @react-native/metro-config. It adds asset and
// resolver defaults that expo-* modules rely on.
const {getDefaultConfig} = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = config;
