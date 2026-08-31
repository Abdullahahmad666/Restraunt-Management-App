import {useCallback} from 'react';

import {tokenStorage} from '../../api/tokenStorage';
import {useAuthStore} from '../../store/authStore';
import {logout} from './api';

/**
 * Blacklists the refresh token server-side, then clears local session state.
 * The server call is best-effort - a phone that is offline, or a refresh
 * token that already expired, should not block someone from signing out.
 */
export function useSignOut(): () => Promise<void> {
  const signOut = useAuthStore(state => state.signOut);

  return useCallback(async () => {
    const refresh = await tokenStorage.getRefreshToken();
    if (refresh) {
      try {
        await logout(refresh);
      } catch {
        // Already expired/blacklisted, or offline - either way, still sign out locally.
      }
    }
    await signOut();
  }, [signOut]);
}
