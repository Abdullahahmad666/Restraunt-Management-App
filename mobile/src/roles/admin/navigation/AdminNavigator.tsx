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
import {tabIcon} from '../../../navigation/tabIcon';
import {tabScreenOptions} from '../../../theme';
import type {AdminStackParamList, AdminTabParamList} from '../../../navigation/types';

const Tab = createBottomTabNavigator<AdminTabParamList>();
const Stack = createNativeStackNavigator<AdminStackParamList>();

function AdminTabs(): React.JSX.Element {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{tabBarIcon: tabIcon('grid-outline', 'grid')}}
      />
      <Tab.Screen
        name="Attendance"
        component={AttendanceLiveScreen}
        options={{tabBarIcon: tabIcon('people-outline', 'people'), title: 'On shift'}}
      />
      <Tab.Screen
        name="Compliance"
        component={ComplianceDashboardScreen}
        options={{tabBarIcon: tabIcon('checkbox-outline', 'checkbox'), title: 'Checks'}}
      />
      <Tab.Screen
        name="Team"
        component={StaffManagementScreen}
        options={{tabBarIcon: tabIcon('id-card-outline', 'id-card')}}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{tabBarIcon: tabIcon('person-circle-outline', 'person-circle')}}
      />
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
