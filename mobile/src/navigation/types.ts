import type {NavigatorScreenParams} from '@react-navigation/native';

import type {AttendanceLog, ScanAction, Shift} from '../features/attendance/types';

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
/** Bottom tabs a floor user sees. Analytics is first, and so the default tab
 * on launch - the punctuality summary is the thing worth seeing first, not
 * a bare scan camera with nothing on it yet. */
export type StaffTabParamList = {
  Analytics: undefined;
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
  MyShifts: undefined;
  // The staff shifts endpoint is list-only (no retrieve-by-id, same reason
  // as ScanResult above), so the shift being offered travels as a param
  // rather than being re-fetched by id. Optional: reached with a shift
  // already picked (a shift card's "Offer this shift" link) or with none
  // (Swap requests' "Request a swap" button), in which case the screen's
  // own first step is picking one.
  RequestSwap: {shift?: Shift} | undefined;
  SwapRequests: undefined;
  ScanHistory: undefined;
  Notifications: undefined;
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
/** Bottom tabs a manager sees - the same shape as the staff side's tab bar:
 * an analytics home, then the areas they manage, then their own account. */
export type AdminTabParamList = {
  // The landing tab: who's on shift right now, then cost/hours/lateness
  // compared across the whole team, plus shortcuts into rota, payroll, the
  // check-in code and notifications - everything that used to live on a
  // separate "Manager" hub tab now lives here instead.
  Analytics: undefined;
  // Team roster/invites plus a shortcut to who's on shift right now - both
  // attendance and team management live under this one tab.
  Staff: undefined;
  Checks: undefined;
  // Food wastage tracking and menu management - no backend for either yet,
  // so this is a placeholder until that feature is built out.
  Food: undefined;
  Profile: undefined;
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
  // Generates and shows one invite code, on its own page - no roster, no
  // clutter, just the code plus share/copy. No deep link shown - JoinScreen
  // already has a type-the-code path, so the code alone is a complete invite.
  InviteStaff: undefined;
  // The full roster - the manager themselves, then every staff account.
  AllStaff: undefined;
  // One staff member: their info, pay rates, and a way into their shifts.
  StaffDetail: {staffId: string};
  // That same staff member's punctuality history - a manager can browse any
  // month, not just the current one.
  StaffAnalytics: {staffId: string};
  // The weekly rota builder: who's on each day, Monday-Sunday, and that
  // day's estimated staff cost.
  Rota: undefined;
  Payroll: undefined;
  // The venue's single check-in QR code, not a per-staff barcode - there is
  // no such thing on the backend, only one VenueQRCode per restaurant.
  StaffBarcode: undefined;
  ComplianceHistory: undefined;
  Equipment: undefined;
  Notifications: undefined;
  // Every staff-raised swap request across the restaurant, and the
  // approve/decline decision on each.
  SwapRequests: undefined;
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
