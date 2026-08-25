import * as SecureStore from 'expo-secure-store';

/**
 * JWTs live in the OS keychain / keystore, not AsyncStorage.
 *
 * AsyncStorage is plain text on disk - anything with filesystem access on a
 * rooted or jailbroken device can read it. expo-secure-store wraps Keychain on
 * iOS and EncryptedSharedPreferences on Android.
 *
 * This replaced react-native-keychain, which is not bundled in Expo Go: using
 * it would have forced a custom dev client before anyone could open the app.
 */
const KEY = 'auth.tokens';

export type TokenPair = {access: string; refresh: string};

let cache: TokenPair | null = null;

export const tokenStorage = {
  async setTokens(tokens: TokenPair): Promise<void> {
    cache = tokens;
    await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
  },

  async getTokens(): Promise<TokenPair | null> {
    if (cache) {
      return cache;
    }
    const stored = await SecureStore.getItemAsync(KEY);
    if (!stored) {
      return null;
    }
    try {
      cache = JSON.parse(stored) as TokenPair;
      return cache;
    } catch {
      // Corrupt or truncated value - drop it rather than wedging login.
      await this.clear();
      return null;
    }
  },

  async getAccessToken(): Promise<string | null> {
    return (await this.getTokens())?.access ?? null;
  },

  async getRefreshToken(): Promise<string | null> {
    return (await this.getTokens())?.refresh ?? null;
  },

  async clear(): Promise<void> {
    cache = null;
    await SecureStore.deleteItemAsync(KEY);
  },
};
