import type {NavigatorScreenParams} from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  /**
   * Reached from the emailed deep link (invisiko://reset-password?uid=..&token=..),
   * so both params arrive from outside the app and must be treated as untrusted
   * strings - the server is what validates them.
   */
  ResetPassword: {uid?: string; token?: string};
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
  Profile: undefined;
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
  Profile: undefined;
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
