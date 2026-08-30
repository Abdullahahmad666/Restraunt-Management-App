import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {AttendanceEditScreen} from '../screens/AttendanceEditScreen';
import {AttendanceHistoryScreen} from '../screens/AttendanceHistoryScreen';
import {AttendanceLiveScreen} from '../screens/AttendanceLiveScreen';
import {ComplianceDashboardScreen} from '../screens/ComplianceDashboardScreen';
import {ComplianceHistoryScreen} from '../screens/ComplianceHistoryScreen';
import {DashboardScreen} from '../screens/DashboardScreen';
import {EquipmentScreen} from '../screens/EquipmentScreen';
import {NotificationsScreen} from '../screens/NotificationsScreen';
import {PayrollScreen} from '../screens/PayrollScreen';
import {StaffBarcodeScreen} from '../screens/StaffBarcodeScreen';
import {StaffManagementScreen} from '../screens/StaffManagementScreen';
import {ProfileScreen} from '../../../roles/common/screens/ProfileScreen';
import {tabScreenOptions} from '../../../theme';
import type {AdminStackParamList, AdminTabParamList} from '../../../navigation/types';

const Tab = createBottomTabNavigator<AdminTabParamList>();
const Stack = createNativeStackNavigator<AdminStackParamList>();

function AdminTabs(): React.JSX.Element {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen
        name="Attendance"
        component={AttendanceLiveScreen}
        options={{title: 'On shift'}}
      />
      <Tab.Screen
        name="Compliance"
        component={ComplianceDashboardScreen}
        options={{title: 'Checks'}}
      />
      <Tab.Screen name="Team" component={StaffManagementScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

/** Everything an owner or manager sees. */
export function AdminNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator>
      <Stack.Screen name="AdminTabs" component={AdminTabs} options={{headerShown: false}} />
      <Stack.Screen name="AttendanceHistory" component={AttendanceHistoryScreen} />
      <Stack.Screen name="AttendanceEdit" component={AttendanceEditScreen} />
      <Stack.Screen name="Payroll" component={PayrollScreen} />
      <Stack.Screen name="StaffBarcode" component={StaffBarcodeScreen} />
      <Stack.Screen name="ComplianceHistory" component={ComplianceHistoryScreen} />
      <Stack.Screen name="Equipment" component={EquipmentScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
