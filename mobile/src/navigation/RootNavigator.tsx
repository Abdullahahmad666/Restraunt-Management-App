import React, {useEffect} from 'react';
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

  // Hand off to BrandSplash as soon as JS is running, rather than holding the
  // native splash until the session check finishes.
  //
  // In a real build the two are pixel-matched - same mark, same navy - so this
  // is invisible. In Expo Go it is the difference between navy and white:
  // Expo Go substitutes its own light splash for the configured one, and
  // holding it up just means staring at white for longer.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // A branded screen rather than null. Returning null relies on the native
  // splash still covering the window, which only holds in a real build - Expo
  // Go hides its own splash as soon as JS starts, so null renders as white.
  if (!settled) {
    return <BrandSplash />;
  }

  return (
    <NavigationContainer theme={navigationTheme} linking={linking}>
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
