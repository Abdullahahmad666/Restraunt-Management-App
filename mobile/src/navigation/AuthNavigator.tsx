import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {ForgotPasswordScreen} from '../roles/common/screens/ForgotPasswordScreen';
import {LoginScreen} from '../roles/common/screens/LoginScreen';
import {ResetPasswordScreen} from '../roles/common/screens/ResetPasswordScreen';
import {SignupScreen} from '../roles/common/screens/SignupScreen';
import {colors} from '../theme';
import type {AuthStackParamList} from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

/** Pre-role: whoever is on these screens has no role yet. */
export function AuthNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: colors.background},
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: {backgroundColor: colors.background},
      }}>
      {/* Login owns the branding, so it draws no header of its own. */}
      <Stack.Screen name="Login" component={LoginScreen} options={{headerShown: false}} />
      <Stack.Screen name="Signup" component={SignupScreen} options={{title: 'Create account'}} />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{title: 'Reset password'}}
      />
      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{title: 'Choose a new password'}}
      />
    </Stack.Navigator>
  );
}
