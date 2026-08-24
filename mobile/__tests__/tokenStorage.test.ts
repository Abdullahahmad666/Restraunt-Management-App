import * as Keychain from 'react-native-keychain';

import {tokenStorage} from '../src/api/tokenStorage';

describe('tokenStorage', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await tokenStorage.clear();
  });

  it('round-trips a token pair through the keychain', async () => {
    const pair = {access: 'access-token', refresh: 'refresh-token'};
    await tokenStorage.setTokens(pair);

    expect(Keychain.setGenericPassword).toHaveBeenCalled();
    await expect(tokenStorage.getAccessToken()).resolves.toBe('access-token');
    await expect(tokenStorage.getRefreshToken()).resolves.toBe('refresh-token');
  });

  it('returns null when nothing is stored', async () => {
    await expect(tokenStorage.getTokens()).resolves.toBeNull();
  });
});
