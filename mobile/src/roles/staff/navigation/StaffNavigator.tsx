import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {CheckDetailScreen} from '../screens/CheckDetailScreen';
import {CorrectiveActionScreen} from '../screens/CorrectiveActionScreen';
import {DailyChecksScreen} from '../screens/DailyChecksScreen';
import {MyAttendanceScreen} from '../screens/MyAttendanceScreen';
import {MyPayScreen} from '../screens/MyPayScreen';
import {ScanResultScreen} from '../screens/ScanResultScreen';
import {ScanScreen} from '../screens/ScanScreen';
import type {StaffStackParamList, StaffTabParamList} from '../../../navigation/types';

const Tab = createBottomTabNavigator<StaffTabParamList>();
const Stack = createNativeStackNavigator<StaffStackParamList>();

function StaffTabs(): React.JSX.Element {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Scan" component={ScanScreen} />
      <Tab.Screen name="Checks" component={DailyChecksScreen} options={{title: 'Today'}} />
      <Tab.Screen name="Attendance" component={MyAttendanceScreen} options={{title: 'My hours'}} />
    </Tab.Navigator>
  );
}

/**
 * Everything a floor user sees.
 *
 * CorrectiveAction is a pushed screen rather than a tab on purpose: a failed
 * check has to route through it, and it should not be reachable by wandering
 * into a tab.
 */
export function StaffNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator>
      <Stack.Screen name="StaffTabs" component={StaffTabs} options={{headerShown: false}} />
      <Stack.Screen name="ScanResult" component={ScanResultScreen} />
      <Stack.Screen name="CheckDetail" component={CheckDetailScreen} />
      <Stack.Screen name="CorrectiveAction" component={CorrectiveActionScreen} />
      <Stack.Screen name="MyPay" component={MyPayScreen} options={{title: 'My pay'}} />
    </Stack.Navigator>
  );
}
