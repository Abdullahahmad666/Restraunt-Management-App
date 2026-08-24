import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {LoginScreen} from '../roles/common/screens/LoginScreen';
import type {AuthStackParamList} from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

/** Pre-role: whoever is at the login screen has no role yet. */
export function AuthNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Login" component={LoginScreen} options={{title: 'Sign in'}} />
    </Stack.Navigator>
  );
}
