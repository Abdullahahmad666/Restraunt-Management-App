/**
 * The one place the app reads configuration from.
 *
 * Values come from mobile/.env. Expo inlines any variable prefixed
 * EXPO_PUBLIC_ at build time, so no babel plugin is involved - but that also
 * means they are embedded in the shipped bundle and readable by anyone with
 * the app. An API base URL is fine. A real secret is not: those belong on the
 * server, or in EAS secrets for build-time-only values.
 *
 * Because the values are inlined, editing .env needs Metro restarted with
 * `npx expo start --clear`, not just a reload.
 *
 * Defaults keep the app runnable with no .env at all. 10.0.2.2 is how the
 * Android emulator reaches the host machine; the iOS simulator uses localhost.
 */
export const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:8000/api/v1',
  apiTimeoutMs: Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS ?? 15000),
  isDev: __DEV__,
} as const;
