/** Notification and device-token shapes. */

export type NotificationKind = 'SHIFT_REMINDER' | 'MISSED_CHECKOUT' | 'COMPLIANCE_OVERDUE';
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
