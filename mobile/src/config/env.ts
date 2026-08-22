import {API_BASE_URL, API_TIMEOUT_MS} from '@env';

/**
 * The one place the app reads configuration from.
 *
 * Values come from mobile/.env via the react-native-dotenv babel plugin, which
 * inlines them at build time - so changing .env needs a Metro restart with
 * `npm start -- --reset-cache`, not just a reload.
 *
 * Defaults keep the app runnable with no .env at all. 10.0.2.2 is how the
 * Android emulator reaches the host machine; the iOS simulator uses localhost.
 */
export const env = {
  apiBaseUrl: API_BASE_URL ?? 'http://10.0.2.2:8000/api/v1',
  apiTimeoutMs: Number(API_TIMEOUT_MS ?? 15000),
  isDev: __DEV__,
} as const;
