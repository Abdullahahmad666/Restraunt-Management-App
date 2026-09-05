import type {LinkingOptions} from '@react-navigation/native';

import {env} from '../config/env';
import type {RootStackParamList} from './types';

/**
 * Deep links into the app.
 *
 * The password-reset email sends `invisiko://reset-password?uid=..&token=..`,
 * and an admin's shared invite sends `invisiko://join?code=..`, both matching
 * `scheme` in app.json. Without this config either link opens the app and
 * lands on the welcome screen, which looks like the link is broken.
 *
 * Both live under the Auth stack because they are reached while signed out. If
 * a signed-in user opens one, React Navigation cannot route to a screen that
 * is not mounted and the link is ignored - the right outcome for reset (use
 * Change password instead) and, for join, unreachable in practice: nobody
 * signed in should still have "join a restaurant" to do.
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    'invisiko://',
    // Expo Go and dev builds serve over exp:// during development.
    ...(env.isDev ? ['exp://'] : []),
  ],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
          SetupTakeaway: 'setup',
          ForgotPassword: 'forgot-password',
          ResetPassword: {
            path: 'reset-password',
            // uid and token arrive from an email, so they are untrusted
            // strings. The server is what validates them.
            parse: {
              uid: (value: string) => value,
              token: (value: string) => value,
            },
          },
          Join: {
            path: 'join',
            // code arrives from a shared link, so it is an untrusted string -
            // the invite lookup and, ultimately, the server are what validate it.
            parse: {code: (value: string) => value},
          },
        },
      },
    },
  },
};
