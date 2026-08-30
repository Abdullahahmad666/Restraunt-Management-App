import React, {useCallback} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';

import {useAuthStore} from '../store/authStore';
import {useRestoreSession} from '../features/auth/useRestoreSession';
import {AdminNavigator} from '../roles/admin/navigation/AdminNavigator';
import {StaffNavigator} from '../roles/staff/navigation/StaffNavigator';
import {ROLES} from '../types/roles';
import {navigationTheme} from '../theme';
import {linking} from './linking';
import {AuthNavigator} from './AuthNavigator';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * The single place the app forks on role.
 *
 * Only one branch is ever mounted, so a staff session never has admin screens
 * in its navigation tree. That is a convenience, not a security boundary - the
 * backend rejects a staff token on an /admin/ path regardless.
 */
export function RootNavigator(): React.JSX.Element | null {
  const status = useAuthStore(state => state.status);
  const user = useAuthStore(state => state.user);

  useRestoreSession();

  const settled = status !== 'idle' && status !== 'loading';

  // Hide the splash only once we know where we are going, and only after the
  // first frame of that destination is laid out - otherwise the splash lifts
  // onto an empty view for a frame.
  const onReady = useCallback(() => {
    if (settled) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [settled]);

  // Returning null keeps the native splash on screen. It is already the brand
  // navy with the logo, so there is nothing better we could draw here - and no
  // spinner means no flash of a different background.
  if (!settled) {
    return null;
  }

  return (
    <NavigationContainer theme={navigationTheme} linking={linking} onReady={onReady}>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        {status !== 'authenticated' || !user ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : user.role === ROLES.ADMIN ? (
          <Stack.Screen name="Admin" component={AdminNavigator} />
        ) : (
          <Stack.Screen name="Staff" component={StaffNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
