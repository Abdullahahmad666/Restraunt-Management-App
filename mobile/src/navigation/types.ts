import type {NavigatorScreenParams} from '@react-navigation/native';

import type {ScanAction, AttendanceLog} from '../features/attendance/types';

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
  Profile: undefined;
};

/** Staff tabs plus the screens pushed on top of them. */
export type StaffStackParamList = {
  StaffTabs: NavigatorScreenParams<StaffTabParamList>;
  // The staff logs endpoint is list-only (no retrieve-by-id), so the scan
  // result is carried in the route params rather than re-fetched by id.
  ScanResult: {action: ScanAction; log: AttendanceLog};
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
  Profile: undefined;
};

export type AdminStackParamList = {
  AdminTabs: NavigatorScreenParams<AdminTabParamList>;
  AttendanceHistory: {staffId?: string};
  // logId corrects an existing log; staffId with no logId creates a new rota
  // shift for that person instead - there is no "create a log" endpoint.
  AttendanceEdit: {logId?: string; staffId?: string};
  Payroll: undefined;
  // The venue's single check-in QR code, not a per-staff barcode - there is
  // no such thing on the backend, only one VenueQRCode per restaurant.
  StaffBarcode: undefined;
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
