/** Notification and device-token shapes. */

export type NotificationKind =
  | 'SHIFT_REMINDER'
  | 'SHIFT_ENDING_SOON'
  | 'SHIFT_ADDED'
  | 'SHIFT_UPDATED'
  | 'SHIFT_CANCELLED'
  | 'STAFF_CHECKED_IN'
  | 'STAFF_CHECKED_OUT'
  | 'MISSED_CHECKOUT'
  | 'COMPLIANCE_OVERDUE'
  | 'SHIFT_SWAP_REQUESTED'
  | 'SHIFT_SWAP_APPROVED'
  | 'SHIFT_SWAP_DECLINED';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  status: NotificationStatus;
  read_at: string | null;
  created_at: string;
};

export type DevicePlatform = 'IOS' | 'ANDROID';

export type DeviceToken = {
  id: string;
  token: string;
  platform: DevicePlatform;
  is_active: boolean;
};
