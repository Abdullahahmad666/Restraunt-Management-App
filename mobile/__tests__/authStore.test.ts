import {tokenStorage} from '../src/api/tokenStorage';
import {logout} from '../src/features/auth/api';
import {useAuthStore} from '../src/store/authStore';
import type {User} from '../src/types/api';

jest.mock('../src/features/auth/api', () => ({
  logout: jest.fn(() => Promise.resolve()),
}));

const someone: User = {
  id: 'u-1',
  email: 'staff@example.com',
  first_name: 'Alex',
  last_name: 'Morgan',
  phone: '',
  profile_picture: null,
  role: 'STAFF',
  restaurant: 'r-1',
};

describe('authStore.signOut', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await tokenStorage.clear();
    useAuthStore.setState({user: null, status: 'idle'});
  });

  it('blacklists the refresh token server-side before dropping it', async () => {
    await tokenStorage.setTokens({access: 'a', refresh: 'r'});
    useAuthStore.getState().setUser(someone);

    await useAuthStore.getState().signOut();

    // Clearing only the device would leave a token valid until it expires -
    // on a shared kiosk, that is someone else's session to pick up.
    expect(logout).toHaveBeenCalledWith('r');
    await expect(tokenStorage.getTokens()).resolves.toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('still signs out locally when the server call fails', async () => {
    (logout as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await tokenStorage.setTokens({access: 'a', refresh: 'r'});
    useAuthStore.getState().setUser(someone);

    await expect(useAuthStore.getState().signOut()).resolves.toBeUndefined();

    // Being unable to reach the server must not strand someone signed in.
    await expect(tokenStorage.getTokens()).resolves.toBeNull();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('does not call the server when there is no refresh token', async () => {
    useAuthStore.getState().setUser(someone);

    await useAuthStore.getState().signOut();

    expect(logout).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });
});
