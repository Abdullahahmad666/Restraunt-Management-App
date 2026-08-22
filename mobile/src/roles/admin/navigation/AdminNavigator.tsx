import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import {DashboardScreen} from '../screens/DashboardScreen';
import {StaffManagementScreen} from '../screens/StaffManagementScreen';
import type {AdminTabParamList} from '../../../navigation/types';

const Tab = createBottomTabNavigator<AdminTabParamList>();

/** Everything an owner or manager sees. */
export function AdminNavigator(): React.JSX.Element {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Staff" component={StaffManagementScreen} options={{title: 'Staff'}} />
    </Tab.Navigator>
  );
}
