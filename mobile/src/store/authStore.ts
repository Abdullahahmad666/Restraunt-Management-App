import {create} from 'zustand';

import {logout} from '../features/auth/api';
import {tokenStorage} from '../api/tokenStorage';
import type {User} from '../types/api';

type AuthState = {
  user: User | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  setUser: (user: User | null) => void;
  setStatus: (status: AuthState['status']) => void;
  signOut: () => Promise<void>;
};

/**
 * Session state only. Server data belongs in react-query, not here - keeping
 * both in a global store is how caches drift out of sync.
 */
export const useAuthStore = create<AuthState>(set => ({
  user: null,
  status: 'idle',
  setUser: user => set({user, status: user ? 'authenticated' : 'unauthenticated'}),
  setStatus: status => set({status}),
  signOut: async () => {
    // Blacklist the refresh token server-side before dropping it locally.
    // Clearing only the device leaves a token that stays valid until it
    // expires - on a shared kiosk that is someone else's session to pick up.
    const refresh = await tokenStorage.getRefreshToken();
    if (refresh) {
      try {
        await logout(refresh);
      } catch {
        // A failed call must not strand someone signed in on the device.
        // Worst case the token lives out its remaining lifetime unused.
      }
    }
    await tokenStorage.clear();
    set({user: null, status: 'unauthenticated'});
  },
}));
