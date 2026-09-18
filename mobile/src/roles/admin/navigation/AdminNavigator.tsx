import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {AllStaffScreen} from '../screens/AllStaffScreen';
import {AttendanceEditScreen} from '../screens/AttendanceEditScreen';
import {AttendanceHistoryScreen} from '../screens/AttendanceHistoryScreen';
import {AttendanceLiveScreen} from '../screens/AttendanceLiveScreen';
import {ComplianceDashboardScreen} from '../screens/ComplianceDashboardScreen';
import {ComplianceHistoryScreen} from '../screens/ComplianceHistoryScreen';
import {EditFridgeScreen} from '../screens/EditFridgeScreen';
import {EquipmentScreen} from '../screens/EquipmentScreen';
import {FoodScreen} from '../screens/FoodScreen';
import {InviteStaffScreen} from '../screens/InviteStaffScreen';
import {ManageChecklistScreen} from '../screens/ManageChecklistScreen';
import {ManageChecklistTemplatesScreen} from '../screens/ManageChecklistTemplatesScreen';
import {ManageChecklistTemplateTasksScreen} from '../screens/ManageChecklistTemplateTasksScreen';
import {ManageFridgesScreen} from '../screens/ManageFridgesScreen';
import {NotificationsScreen} from '../screens/NotificationsScreen';
import {PayrollScreen} from '../screens/PayrollScreen';
import {RotaScreen} from '../screens/RotaScreen';
import {StaffAnalyticsScreen} from '../screens/StaffAnalyticsScreen';
import {StaffBarcodeScreen} from '../screens/StaffBarcodeScreen';
import {StaffDetailScreen} from '../screens/StaffDetailScreen';
import {StaffManagementScreen} from '../screens/StaffManagementScreen';
import {SwapRequestsScreen} from '../screens/SwapRequestsScreen';
import {TeamAnalyticsScreen} from '../screens/TeamAnalyticsScreen';
import {ChecklistScreen} from '../../../roles/common/screens/ChecklistScreen';
import {ChecklistTemplateTasksScreen} from '../../../roles/common/screens/ChecklistTemplateTasksScreen';
import {FridgeTemperaturesScreen} from '../../../roles/common/screens/FridgeTemperaturesScreen';
import {OtherChecklistsScreen} from '../../../roles/common/screens/OtherChecklistsScreen';
import {ProfileScreen} from '../../../roles/common/screens/ProfileScreen';
import {RoutineScreen} from '../../../roles/common/screens/RoutineScreen';
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
      <Stack.Screen
        name="ComplianceHistory"
        component={ComplianceHistoryScreen}
        options={{title: 'Temperature history'}}
      />
      <Stack.Screen name="Equipment" component={EquipmentScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen
        name="SwapRequests"
        component={SwapRequestsScreen}
        options={{title: 'Swap requests'}}
      />
      <Stack.Screen name="Routine" component={RoutineScreen} options={{title: ''}} />
      <Stack.Screen
        name="FridgeTemperatures"
        component={FridgeTemperaturesScreen}
        options={{title: 'Temperatures'}}
      />
      <Stack.Screen name="Checklist" component={ChecklistScreen} options={{title: 'Checklist'}} />
      <Stack.Screen
        name="OtherChecklists"
        component={OtherChecklistsScreen}
        options={{title: 'Other checklists'}}
      />
      <Stack.Screen
        name="ChecklistTemplateTasks"
        component={ChecklistTemplateTasksScreen}
        options={{title: 'Checklist'}}
      />
      <Stack.Screen
        name="ManageFridges"
        component={ManageFridgesScreen}
        options={{title: 'Fridges & freezers'}}
      />
      <Stack.Screen name="EditFridge" component={EditFridgeScreen} options={{title: ''}} />
      <Stack.Screen
        name="ManageChecklist"
        component={ManageChecklistScreen}
        options={{title: 'Manage checklist'}}
      />
      <Stack.Screen
        name="ManageChecklistTemplates"
        component={ManageChecklistTemplatesScreen}
        options={{title: 'Manage checklists'}}
      />
      <Stack.Screen
        name="ManageChecklistTemplateTasks"
        component={ManageChecklistTemplateTasksScreen}
        options={{title: 'Manage tasks'}}
      />
    </Stack.Navigator>
  );
}
