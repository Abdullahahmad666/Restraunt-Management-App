/**
 * Typing for the environment variables the app reads.
 *
 * Expo inlines EXPO_PUBLIC_* variables at build time but ships no type for
 * `process`. Rather than pull in @types/node - which would also make Buffer,
 * fs and friends typecheck despite not existing at runtime - declare exactly
 * the surface this app uses.
 *
 * This lives under src/ rather than in expo-env.d.ts on purpose: the Expo CLI
 * rewrites tsconfig.json's `include` array on every `expo install`, which drops
 * root-level .d.ts files. The `src/**` glob survives that.
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
