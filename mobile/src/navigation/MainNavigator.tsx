import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import {DashboardScreen} from '../features/dashboard/DashboardScreen';
import {InventoryScreen} from '../features/inventory/InventoryScreen';
import {OrdersScreen} from '../features/orders/OrdersScreen';
import type {MainTabParamList} from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainNavigator(): React.JSX.Element {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Inventory" component={InventoryScreen} />
    </Tab.Navigator>
  );
}
