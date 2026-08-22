import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {LoginScreen} from '../features/auth/LoginScreen';
import type {AuthStackParamList} from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Login" component={LoginScreen} options={{title: 'Sign in'}} />
    </Stack.Navigator>
  );
}
