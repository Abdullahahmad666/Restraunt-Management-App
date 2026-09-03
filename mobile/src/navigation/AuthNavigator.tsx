import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {ForgotPasswordScreen} from '../roles/common/screens/ForgotPasswordScreen';
import {JoinScreen} from '../roles/common/screens/JoinScreen';
import {LoginScreen} from '../roles/common/screens/LoginScreen';
import {ResetPasswordScreen} from '../roles/common/screens/ResetPasswordScreen';
import {SetupTakeawayScreen} from '../roles/common/screens/SetupTakeawayScreen';
import {VerifyEmailScreen} from '../roles/common/screens/VerifyEmailScreen';
import {WelcomeScreen} from '../roles/common/screens/WelcomeScreen';
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
      {/* Welcome owns the branding, so it draws no header of its own. */}
      <Stack.Screen name="Welcome" component={WelcomeScreen} options={{headerShown: false}} />
      <Stack.Screen name="Login" component={LoginScreen} options={{title: ''}} />
      <Stack.Screen name="SetupTakeaway" component={SetupTakeawayScreen} options={{title: ''}} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} options={{title: ''}} />
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
      {/* Reached only via an admin's shared invite link, never by tapping
          through the app - see JoinScreen. */}
      <Stack.Screen name="Join" component={JoinScreen} options={{title: ''}} />
    </Stack.Navigator>
  );
}
