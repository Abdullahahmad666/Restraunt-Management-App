import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {AddStaffScreen} from '../screens/AddStaffScreen';
import {AttendanceEditScreen} from '../screens/AttendanceEditScreen';
import {AttendanceHistoryScreen} from '../screens/AttendanceHistoryScreen';
import {AttendanceLiveScreen} from '../screens/AttendanceLiveScreen';
import {ComplianceDashboardScreen} from '../screens/ComplianceDashboardScreen';
import {ComplianceHistoryScreen} from '../screens/ComplianceHistoryScreen';
import {DashboardScreen} from '../screens/DashboardScreen';
import {EquipmentScreen} from '../screens/EquipmentScreen';
import {FoodScreen} from '../screens/FoodScreen';
import {InviteStaffScreen} from '../screens/InviteStaffScreen';
import {NotificationsScreen} from '../screens/NotificationsScreen';
import {PayrollScreen} from '../screens/PayrollScreen';
import {StaffBarcodeScreen} from '../screens/StaffBarcodeScreen';
import {StaffDetailScreen} from '../screens/StaffDetailScreen';
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
        name="Staff"
        component={StaffManagementScreen}
        options={{tabBarIcon: tabIcon('people-outline', 'people')}}
      />
      <Tab.Screen
        name="Manager"
        component={DashboardScreen}
        options={{tabBarIcon: tabIcon('grid-outline', 'grid')}}
      />
      <Tab.Screen
        name="Compliance"
        component={ComplianceDashboardScreen}
        options={{tabBarIcon: tabIcon('checkbox-outline', 'checkbox'), title: 'Checks'}}
      />
      <Tab.Screen
        name="Food"
        component={FoodScreen}
        options={{tabBarIcon: tabIcon('restaurant-outline', 'restaurant')}}
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
      <Stack.Screen
        name="AttendanceLive"
        component={AttendanceLiveScreen}
        options={{title: 'On shift'}}
      />
      <Stack.Screen name="AddStaff" component={AddStaffScreen} options={{title: ''}} />
      <Stack.Screen name="InviteStaff" component={InviteStaffScreen} options={{title: ''}} />
      <Stack.Screen name="StaffDetail" component={StaffDetailScreen} options={{title: ''}} />
      <Stack.Screen name="Payroll" component={PayrollScreen} />
      <Stack.Screen name="StaffBarcode" component={StaffBarcodeScreen} />
      <Stack.Screen name="ComplianceHistory" component={ComplianceHistoryScreen} />
      <Stack.Screen name="Equipment" component={EquipmentScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}
