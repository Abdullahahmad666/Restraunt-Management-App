import type {NavigatorScreenParams} from '@react-navigation/native';

import type {ScanAction, AttendanceLog} from '../features/attendance/types';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  /** Admin only - the only way an ADMIN account gets made. Staff never see
   * this screen; they arrive through Join instead. */
  SetupTakeaway: undefined;
  /**
   * Reached right after registering (SetupTakeaway or Join) - the backend
   * refuses to log an account in until its email is verified, so this comes
   * before the first sign-in rather than after. Carries the password along
   * so it can sign in immediately once the code checks out, rather than
   * bouncing back to a login form with the fields empty.
   */
  VerifyEmail: {email: string; password: string};
  ForgotPassword: undefined;
  /**
   * Reached from the emailed deep link (invisiko://reset-password?uid=..&token=..),
   * so both params arrive from outside the app and must be treated as untrusted
   * strings - the server is what validates them.
   */
  ResetPassword: {uid?: string; token?: string};
  /**
   * Reached from an admin's shared invite link (invisiko://join?code=..).
   * `code` arrives from outside the app - the server is what validates it,
   * this screen only reads it to look up who/where it's for.
   */
  Join: {code?: string};
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
  // Team roster/invites plus a shortcut to who's on shift right now - both
  // attendance and team management live under this one tab.
  Staff: undefined;
  // The owner/manager's own landing tab: shift stats, quick shortcuts
  // (payroll, QR code, notifications), and their own account.
  Manager: undefined;
  Compliance: undefined;
  // Food wastage tracking and menu management - no backend for either yet,
  // so this is a placeholder until that feature is built out.
  Food: undefined;
};

export type AdminStackParamList = {
  AdminTabs: NavigatorScreenParams<AdminTabParamList>;
  AttendanceHistory: {staffId?: string};
  // logId corrects an existing log; staffId with no logId creates a new rota
  // shift for that person instead - there is no "create a log" endpoint.
  AttendanceEdit: {logId?: string; staffId?: string};
  // Who is checked in right now - reached from the Staff tab, not a tab of
  // its own now that Staff and Attendance share one tab.
  AttendanceLive: undefined;
  // The manual add-staff form, pulled out of the Staff tab's roster so that
  // screen stays a plain list.
  AddStaff: undefined;
  // Generates and shows one invite link, on its own page - no roster, no
  // clutter, just the link plus share/copy.
  InviteStaff: undefined;
  // One staff member: their info, pay rates, and a way into their shifts.
  StaffDetail: {staffId: string};
  Payroll: undefined;
  // The venue's single check-in QR code, not a per-staff barcode - there is
  // no such thing on the backend, only one VenueQRCode per restaurant.
  StaffBarcode: undefined;
  ComplianceHistory: undefined;
  Equipment: undefined;
  Notifications: undefined;
  // Reached from the Manager tab now that Profile isn't a tab of its own.
  Profile: undefined;
};

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Staff: NavigatorScreenParams<StaffStackParamList>;
  Admin: NavigatorScreenParams<AdminStackParamList>;
  /** An ADMIN whose self-registered restaurant a super admin hasn't approved
   * yet in Django Admin (see restaurant_is_approved on /me/). */
  PendingApproval: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
