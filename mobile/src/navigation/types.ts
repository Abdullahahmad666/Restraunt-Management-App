import type {NavigatorScreenParams} from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
};

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------
/** Bottom tabs a floor user sees. */
export type StaffTabParamList = {
  Scan: undefined;
  Checks: undefined;
  Attendance: undefined;
};

/** Staff tabs plus the screens pushed on top of them. */
export type StaffStackParamList = {
  StaffTabs: NavigatorScreenParams<StaffTabParamList>;
  ScanResult: {logId: string};
  CheckDetail: {taskId: string};
  CorrectiveAction: {taskId: string};
  MyPay: undefined;
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export type AdminTabParamList = {
  Dashboard: undefined;
  Attendance: undefined;
  Compliance: undefined;
  Team: undefined;
};

export type AdminStackParamList = {
  AdminTabs: NavigatorScreenParams<AdminTabParamList>;
  AttendanceHistory: {staffId?: string};
  AttendanceEdit: {logId?: string; staffId?: string};
  Payroll: undefined;
  StaffBarcode: {staffId: string};
  ComplianceHistory: undefined;
  Equipment: undefined;
  Notifications: undefined;
};

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Staff: NavigatorScreenParams<StaffStackParamList>;
  Admin: NavigatorScreenParams<AdminStackParamList>;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
