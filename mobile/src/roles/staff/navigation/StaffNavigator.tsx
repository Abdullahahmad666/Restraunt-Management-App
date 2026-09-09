import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {AnalyticsScreen} from '../screens/AnalyticsScreen';
import {CheckDetailScreen} from '../screens/CheckDetailScreen';
import {CorrectiveActionScreen} from '../screens/CorrectiveActionScreen';
import {DailyChecksScreen} from '../screens/DailyChecksScreen';
import {MyAttendanceScreen} from '../screens/MyAttendanceScreen';
import {MyPayScreen} from '../screens/MyPayScreen';
import {MyShiftsScreen} from '../screens/MyShiftsScreen';
import {NotificationsScreen} from '../screens/NotificationsScreen';
import {RequestSwapScreen} from '../screens/RequestSwapScreen';
import {ScanHistoryScreen} from '../screens/ScanHistoryScreen';
import {ScanResultScreen} from '../screens/ScanResultScreen';
import {ScanScreen} from '../screens/ScanScreen';
import {SwapRequestsScreen} from '../screens/SwapRequestsScreen';
import {ProfileScreen} from '../../../roles/common/screens/ProfileScreen';
import {tabIcon} from '../../../navigation/tabIcon';
import {tabScreenOptions} from '../../../theme';
import type {StaffStackParamList, StaffTabParamList} from '../../../navigation/types';

const Tab = createBottomTabNavigator<StaffTabParamList>();
const Stack = createNativeStackNavigator<StaffStackParamList>();

function StaffTabs(): React.JSX.Element {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions} initialRouteName="Analytics">
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{tabBarIcon: tabIcon('stats-chart-outline', 'stats-chart')}}
      />
      <Tab.Screen
        name="Scan"
        component={ScanScreen}
        options={{tabBarIcon: tabIcon('scan-outline', 'scan')}}
      />
      <Tab.Screen
        name="Checks"
        component={DailyChecksScreen}
        options={{tabBarIcon: tabIcon('checkbox-outline', 'checkbox'), title: 'Today'}}
      />
      <Tab.Screen
        name="Attendance"
        component={MyAttendanceScreen}
        options={{tabBarIcon: tabIcon('time-outline', 'time'), title: 'My hours'}}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{tabBarIcon: tabIcon('person-circle-outline', 'person-circle')}}
      />
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
      <Stack.Screen name="MyShifts" component={MyShiftsScreen} options={{title: 'My shifts'}} />
      <Stack.Screen
        name="RequestSwap"
        component={RequestSwapScreen}
        options={{title: 'Offer this shift'}}
      />
      <Stack.Screen
        name="SwapRequests"
        component={SwapRequestsScreen}
        options={{title: 'Swap requests'}}
      />
      <Stack.Screen
        name="ScanHistory"
        component={ScanHistoryScreen}
        options={{title: 'Scan history'}}
      />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
