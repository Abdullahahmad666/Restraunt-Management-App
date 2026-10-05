import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';

import {BrandSplash} from '../components/BrandSplash';
import {useAuthStore} from '../store/authStore';
import {useRestoreSession} from '../features/auth/useRestoreSession';
import {useRegisterPushToken} from '../features/notifications/hooks';
import {AdminNavigator} from '../roles/admin/navigation/AdminNavigator';
import {StaffNavigator} from '../roles/staff/navigation/StaffNavigator';
import {PendingApprovalScreen} from '../roles/common/screens/PendingApprovalScreen';
import {ROLES} from '../types/roles';
import {colors, navigationTheme} from '../theme';
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
  useRegisterPushToken(status === 'authenticated' && Boolean(user));

  const settled = status !== 'idle' && status !== 'loading';

  // Whether the session check has gone on long enough to be worth explaining.
  //
  // With no tokens stored - a first launch, or after signing out - the check
  // is a single SecureStore read and settles in a few milliseconds. Showing
  // the full branded splash for that long is a flash of mark, wordmark and
  // spinner between the native splash and the welcome screen: visible, and
  // read as a glitch rather than as loading.
  //
  // So nothing but the ground colour until the wait is real. Nothing waits
  // longer than it did; a fast start simply stops announcing itself.
  const [waitIsReal, setWaitIsReal] = useState(false);
  useEffect(() => {
    if (settled) {
      return;
    }
    const timer = setTimeout(() => setWaitIsReal(true), 180);
    return () => clearTimeout(timer);
  }, [settled]);

  // Hand off to BrandSplash as soon as JS is running, rather than holding the
  // native splash until the session check finishes.
  //
  // In a real build the two are pixel-matched - same mark, same black - so
  // this is invisible. In Expo Go it is the difference between black and white:
  // Expo Go substitutes its own light splash for the configured one, and
  // holding it up just means staring at white for longer.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Never null. Returning null relies on the native splash still covering the
  // window, which only holds in a real build - Expo Go hides its own splash as
  // soon as JS starts, so null renders as white.
  if (!settled) {
    return waitIsReal ? <BrandSplash /> : <View style={styles.hold} />;
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

const styles = StyleSheet.create({
  // The same black the native splash is set to in app.json, so the hand-off
  // from it is one continuous surface.
  hold: {flex: 1, backgroundColor: colors.background},
});
