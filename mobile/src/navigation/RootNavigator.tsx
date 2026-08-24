import React from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {useAuthStore} from '../store/authStore';
import {useRestoreSession} from '../features/auth/useRestoreSession';
import {AdminNavigator} from '../roles/admin/navigation/AdminNavigator';
import {StaffNavigator} from '../roles/staff/navigation/StaffNavigator';
import {ROLES} from '../types/roles';
import {AuthNavigator} from './AuthNavigator';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * The single place the app forks on role.
 *
 * Only one branch is ever mounted, so a staff build never has admin screens in
 * its navigation tree. That is a convenience, not a security boundary - the
 * backend rejects a staff token on an /admin/ path regardless.
 */
export function RootNavigator(): React.JSX.Element {
  const status = useAuthStore(state => state.status);
  const user = useAuthStore(state => state.user);

  useRestoreSession();

  if (status === 'idle' || status === 'loading') {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
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

const styles = StyleSheet.create({
  splash: {flex: 1, alignItems: 'center', justifyContent: 'center'},
});
