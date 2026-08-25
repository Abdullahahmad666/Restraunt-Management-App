/// <reference types="expo/types" />

/**
 * Expo inlines EXPO_PUBLIC_* variables at build time, but ships no type for
 * `process`. Rather than pull in @types/node - which would also make Buffer,
 * fs and friends typecheck despite not existing at runtime - declare exactly
 * the surface this app reads.
 *
 * Add an entry for every variable in .env.example. A typo in a name then
 * becomes a type error instead of a silent undefined.
 */
declare const process: {
  env: {
    EXPO_PUBLIC_API_BASE_URL?: string;
    EXPO_PUBLIC_API_TIMEOUT_MS?: string;
  };
};
