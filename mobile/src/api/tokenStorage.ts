import * as Keychain from 'react-native-keychain';

/**
 * JWTs live in the OS keychain / keystore, not AsyncStorage.
 *
 * AsyncStorage is plain text on disk - anything with filesystem access on a
 * rooted or jailbroken device can read it.
 */
const SERVICE = 'restaurant-management.auth';

export type TokenPair = {access: string; refresh: string};

let cache: TokenPair | null = null;

export const tokenStorage = {
  async setTokens(tokens: TokenPair): Promise<void> {
    cache = tokens;
    await Keychain.setGenericPassword('tokens', JSON.stringify(tokens), {service: SERVICE});
  },

  async getTokens(): Promise<TokenPair | null> {
    if (cache) {
      return cache;
    }
    const stored = await Keychain.getGenericPassword({service: SERVICE});
    if (!stored) {
      return null;
    }
    try {
      cache = JSON.parse(stored.password) as TokenPair;
      return cache;
    } catch {
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
    await Keychain.resetGenericPassword({service: SERVICE});
  },
};
