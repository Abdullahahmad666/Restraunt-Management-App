import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {AllStaffScreen} from '../screens/AllStaffScreen';
import {AttendanceEditScreen} from '../screens/AttendanceEditScreen';
import {AttendanceHistoryScreen} from '../screens/AttendanceHistoryScreen';
import {AttendanceLiveScreen} from '../screens/AttendanceLiveScreen';
import {ComplianceDashboardScreen} from '../screens/ComplianceDashboardScreen';
import {ComplianceHistoryScreen} from '../screens/ComplianceHistoryScreen';
import {EquipmentScreen} from '../screens/EquipmentScreen';
import {FoodScreen} from '../screens/FoodScreen';
import {InviteStaffScreen} from '../screens/InviteStaffScreen';
import {NotificationsScreen} from '../screens/NotificationsScreen';
import {PayrollScreen} from '../screens/PayrollScreen';
import {RotaScreen} from '../screens/RotaScreen';
import {StaffAnalyticsScreen} from '../screens/StaffAnalyticsScreen';
import {StaffBarcodeScreen} from '../screens/StaffBarcodeScreen';
import {StaffDetailScreen} from '../screens/StaffDetailScreen';
import {StaffManagementScreen} from '../screens/StaffManagementScreen';
import {SwapRequestsScreen} from '../screens/SwapRequestsScreen';
import {TeamAnalyticsScreen} from '../screens/TeamAnalyticsScreen';
import {ProfileScreen} from '../../../roles/common/screens/ProfileScreen';
import {tabIcon} from '../../../navigation/tabIcon';
import {tabScreenOptions} from '../../../theme';
import type {AdminStackParamList, AdminTabParamList} from '../../../navigation/types';

const Tab = createBottomTabNavigator<AdminTabParamList>();
const Stack = createNativeStackNavigator<AdminStackParamList>();

/** Same tab-bar shape as the staff side: an analytics home first (and the
 * default tab), then the areas a manager works in, then their own account. */
function AdminTabs(): React.JSX.Element {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions} initialRouteName="Analytics">
      <Tab.Screen
        name="Analytics"
        component={TeamAnalyticsScreen}
        options={{tabBarIcon: tabIcon('stats-chart-outline', 'stats-chart')}}
      />
      <Tab.Screen
        name="Staff"
        component={StaffManagementScreen}
        options={{tabBarIcon: tabIcon('people-outline', 'people')}}
      />
      <Tab.Screen
        name="Checks"
        component={ComplianceDashboardScreen}
        options={{tabBarIcon: tabIcon('checkbox-outline', 'checkbox')}}
      />
      <Tab.Screen
        name="Food"
        component={FoodScreen}
        options={{tabBarIcon: tabIcon('restaurant-outline', 'restaurant')}}
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
      <Stack.Screen
        name="AttendanceLive"
        component={AttendanceLiveScreen}
        options={{title: 'On shift'}}
      />
      <Stack.Screen name="InviteStaff" component={InviteStaffScreen} options={{title: ''}} />
      <Stack.Screen name="AllStaff" component={AllStaffScreen} options={{title: 'All staff'}} />
      <Stack.Screen name="StaffDetail" component={StaffDetailScreen} options={{title: ''}} />
      <Stack.Screen
        name="StaffAnalytics"
        component={StaffAnalyticsScreen}
        options={{title: 'Analytics'}}
      />
      <Stack.Screen name="Rota" component={RotaScreen} options={{title: 'Weekly rota'}} />
      <Stack.Screen name="Payroll" component={PayrollScreen} />
      <Stack.Screen name="StaffBarcode" component={StaffBarcodeScreen} />
      <Stack.Screen name="ComplianceHistory" component={ComplianceHistoryScreen} />
      <Stack.Screen name="Equipment" component={EquipmentScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen
        name="SwapRequests"
        component={SwapRequestsScreen}
        options={{title: 'Swap requests'}}
      />
    </Stack.Navigator>
  );
}
