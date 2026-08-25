import * as SecureStore from 'expo-secure-store';

import {tokenStorage} from '../src/api/tokenStorage';

describe('tokenStorage', () => {
  beforeEach(async () => {
    await tokenStorage.clear();
    jest.clearAllMocks();
  });

  it('round-trips a token pair through secure storage', async () => {
    const pair = {access: 'access-token', refresh: 'refresh-token'};
    await tokenStorage.setTokens(pair);

    expect(SecureStore.setItemAsync).toHaveBeenCalled();
    await expect(tokenStorage.getAccessToken()).resolves.toBe('access-token');
    await expect(tokenStorage.getRefreshToken()).resolves.toBe('refresh-token');
  });

  it('returns null when nothing is stored', async () => {
    await expect(tokenStorage.getTokens()).resolves.toBeNull();
  });

  it('discards a corrupt stored value instead of throwing', async () => {
    await (SecureStore.setItemAsync as jest.Mock)('auth.tokens', 'not json');
    await expect(tokenStorage.getTokens()).resolves.toBeNull();
  });
});
