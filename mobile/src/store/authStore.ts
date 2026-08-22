import {create} from 'zustand';

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
    await tokenStorage.clear();
    set({user: null, status: 'unauthenticated'});
  },
}));
