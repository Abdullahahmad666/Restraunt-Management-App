/** AttendanceLog, Shift, ScanResult, and the check-in status union. */

export type AttendanceStatus = 'OPEN' | 'CLOSED';

/** What a staff member is covering on a given shift - independent of their
 * account Role (STAFF/ADMIN, an access level). The same person can be
 * scheduled as CHEF one day and TILL_OPERATOR the next. */
export type JobTitle = 'CHEF' | 'DRIVER' | 'TILL_OPERATOR';

export const JOB_TITLE_LABELS: Record<JobTitle, string> = {
  CHEF: 'Chef',
  DRIVER: 'Driver',
  TILL_OPERATOR: 'Till operator',
};

export type Shift = {
  id: string;
  staff: string;
  starts_at: string;
  ends_at: string;
  job_title: JobTitle | '';
  notes: string;
};

/** Admin-only fields, present when the shift comes back from /admin/shifts/. */
export type AdminShift = Shift & {
  restaurant: string;
  reminder_sent_at: string | null;
  created_by: string | null;
};

export type AttendanceLog = {
  id: string;
  staff: string;
  shift: string | null;
  clock_in_at: string;
  clock_in_latitude: string;
  clock_in_longitude: string;
  clock_out_at: string | null;
  clock_out_latitude: string | null;
  clock_out_longitude: string | null;
  status: AttendanceStatus;
  is_manual_override: boolean;
};

export type ScanAction = 'check_in' | 'check_out' | 'already_checked_in';

export type ScanRequest = {
  token: string;
  latitude: number;
  longitude: number;
};

export type ScanResponse = {
  action: ScanAction;
  log: AttendanceLog;
};

export type VenueQRCode = {
  id: string;
  restaurant: string;
  token: string;
  latitude: string;
  longitude: string;
  radius_meters: number;
  is_active: boolean;
};

export type AttendanceLogCorrection = {
  clock_in_at?: string;
  clock_out_at?: string | null;
  status?: AttendanceStatus;
  shift?: string | null;
};
