/** Calls to /staff/{devices,notifications}/ and /admin/notifications/. */
import {apiClient} from '../../api/client';
import {endpoints} from '../../api/endpoints';
import type {Paginated} from '../../types/api';
import type {AppNotification, DevicePlatform, DeviceToken} from './types';

export async function myNotifications(): Promise<Paginated<AppNotification>> {
  const {data} = await apiClient.get<Paginated<AppNotification>>(
    endpoints.staff.notifications.list,
  );
  return data;
}

export async function markRead(id: string): Promise<AppNotification> {
  const {data} = await apiClient.post<AppNotification>(endpoints.staff.notifications.markRead(id));
  return data;
}

export async function registerDevice(
  token: string,
  platform: DevicePlatform,
): Promise<DeviceToken> {
  const {data} = await apiClient.post<DeviceToken>(endpoints.staff.notifications.devices, {
    token,
    platform,
  });
  return data;
}

export async function allNotifications(): Promise<Paginated<AppNotification>> {
  const {data} = await apiClient.get<Paginated<AppNotification>>(
    endpoints.admin.notifications.list,
  );
  return data;
}
