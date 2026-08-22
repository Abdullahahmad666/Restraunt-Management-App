import type {NavigatorScreenParams} from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

/** Floor screens. Reachable by STAFF and ADMIN. */
export type StaffTabParamList = {
  Orders: undefined;
  Inventory: undefined;
};

/** Management screens. ADMIN only. */
export type AdminTabParamList = {
  Dashboard: undefined;
  Staff: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Staff: NavigatorScreenParams<StaffTabParamList>;
  Admin: NavigatorScreenParams<AdminTabParamList>;
  OrderDetail: {orderId: string};
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
