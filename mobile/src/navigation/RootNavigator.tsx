import React, {useCallback} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';

import {BrandSplash} from '../components/BrandSplash';
import {useAuthStore} from '../store/authStore';
import {useRestoreSession} from '../features/auth/useRestoreSession';
import {AdminNavigator} from '../roles/admin/navigation/AdminNavigator';
import {StaffNavigator} from '../roles/staff/navigation/StaffNavigator';
import {PendingApprovalScreen} from '../roles/common/screens/PendingApprovalScreen';
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

  // A branded screen rather than null. Returning null relies on the native
  // splash still covering the window, which only holds in a real build - Expo
  // Go hides its own splash as soon as JS starts, so null renders as white.
  if (!settled) {
    return <BrandSplash />;
  }

  return (
    <NavigationContainer theme={navigationTheme} linking={linking} onReady={onReady}>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        {status !== 'authenticated' || !user ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : user.role === ROLES.ADMIN && user.restaurant_is_approved === false ? (
          <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} />
        ) : user.role === ROLES.ADMIN ? (
          <Stack.Screen name="Admin" component={AdminNavigator} />
        ) : (
          <Stack.Screen name="Staff" component={StaffNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
