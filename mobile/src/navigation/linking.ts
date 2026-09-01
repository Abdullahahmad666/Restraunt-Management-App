import type {LinkingOptions} from '@react-navigation/native';

import {env} from '../config/env';
import type {RootStackParamList} from './types';

/**
 * Deep links into the app.
 *
 * The password-reset email sends `invisiko://reset-password?uid=..&token=..`,
 * matching `scheme` in app.json. Without this config the link opens the app and
 * lands on the login screen, which looks like the email is broken.
 *
 * Reset lives under the Auth stack because it is reached while signed out. If a
 * signed-in user opens the link, React Navigation cannot route to a screen that
 * is not mounted and the link is ignored - which is the right outcome: someone
 * already signed in should use Change password, not a reset link.
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
          Signup: 'signup',
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
        },
      },
    },
  },
};
