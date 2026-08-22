import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import {InventoryScreen} from '../screens/InventoryScreen';
import {OrdersScreen} from '../screens/OrdersScreen';
import type {StaffTabParamList} from '../../../navigation/types';

const Tab = createBottomTabNavigator<StaffTabParamList>();

/** Everything a floor user sees. Add staff screens here, not in RootNavigator. */
export function StaffNavigator(): React.JSX.Element {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Inventory" component={InventoryScreen} />
    </Tab.Navigator>
  );
}
