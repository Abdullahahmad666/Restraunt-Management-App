import {useEffect} from 'react';

import {tokenStorage} from '../../api/tokenStorage';
import {useAuthStore} from '../../store/authStore';
import {fetchMe} from './authApi';

/**
 * On cold start, turn a stored refresh token back into a signed-in session.
 * Runs once from RootNavigator, which shows a spinner until it settles.
 */
export function useRestoreSession(): void {
  const setUser = useAuthStore(state => state.setUser);
  const setStatus = useAuthStore(state => state.setStatus);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      setStatus('loading');
      const tokens = await tokenStorage.getTokens();

      if (!tokens) {
        if (!cancelled) {
          setStatus('unauthenticated');
        }
        return;
      }

      try {
        // A 401 here is refreshed transparently by the axios interceptor.
        const user = await fetchMe();
        if (!cancelled) {
          setUser(user);
        }
      } catch {
        await tokenStorage.clear();
        if (!cancelled) {
          setStatus('unauthenticated');
        }
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, [setStatus, setUser]);
}
