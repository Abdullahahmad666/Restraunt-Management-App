/** Calls to /staff/{scan,shifts,logs}/ and /admin/{shifts,logs,qr-codes}/. */
import {apiClient} from '../../api/client';
import {endpoints} from '../../api/endpoints';
import type {Paginated} from '../../types/api';
import type {
  AdminShift,
  AttendanceLog,
  AttendanceLogCorrection,
  ScanRequest,
  ScanResponse,
  Shift,
  VenueQRCode,
} from './types';

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export async function scan(request: ScanRequest): Promise<ScanResponse> {
  const {data} = await apiClient.post<ScanResponse>(endpoints.staff.attendance.scan, request);
  return data;
}

export async function myShifts(): Promise<Paginated<Shift>> {
  const {data} = await apiClient.get<Paginated<Shift>>(endpoints.staff.attendance.shifts);
  return data;
}

export async function myLogs(): Promise<Paginated<AttendanceLog>> {
  const {data} = await apiClient.get<Paginated<AttendanceLog>>(endpoints.staff.attendance.logs);
  return data;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function liveLogs(): Promise<AttendanceLog[]> {
  const {data} = await apiClient.get<AttendanceLog[]>(endpoints.admin.attendance.live);
  return data;
}

export async function listLogs(params?: {
  staff?: string;
  status?: string;
}): Promise<Paginated<AttendanceLog>> {
  const {data} = await apiClient.get<Paginated<AttendanceLog>>(endpoints.admin.attendance.logs, {
    params,
  });
  return data;
}

export async function getLog(id: string): Promise<AttendanceLog> {
  const {data} = await apiClient.get<AttendanceLog>(endpoints.admin.attendance.log(id));
  return data;
}

export async function updateLog(
  id: string,
  correction: AttendanceLogCorrection,
): Promise<AttendanceLog> {
  const {data} = await apiClient.patch<AttendanceLog>(
    endpoints.admin.attendance.log(id),
    correction,
  );
  return data;
}

export async function listShifts(params?: {staff?: string}): Promise<Paginated<AdminShift>> {
  const {data} = await apiClient.get<Paginated<AdminShift>>(endpoints.admin.attendance.shifts, {
    params,
  });
  return data;
}

export type CreateShiftInput = {
  staff: string;
  starts_at: string;
  ends_at: string;
  notes?: string;
};

export async function createShift(input: CreateShiftInput): Promise<AdminShift> {
  const {data} = await apiClient.post<AdminShift>(endpoints.admin.attendance.shifts, input);
  return data;
}

export async function deleteShift(id: string): Promise<void> {
  await apiClient.delete(endpoints.admin.attendance.shift(id));
}

export async function venueQrCodes(): Promise<Paginated<VenueQRCode>> {
  const {data} = await apiClient.get<Paginated<VenueQRCode>>(endpoints.admin.attendance.qrCodes);
  return data;
}

export type CreateQrCodeInput = {
  restaurant: string;
  latitude: number;
  longitude: number;
  radius_meters?: number;
};

export async function createVenueQrCode(input: CreateQrCodeInput): Promise<VenueQRCode> {
  const {data} = await apiClient.post<VenueQRCode>(endpoints.admin.attendance.qrCodes, input);
  return data;
}

export async function regenerateVenueQrCode(id: string): Promise<VenueQRCode> {
  const {data} = await apiClient.post<VenueQRCode>(endpoints.admin.attendance.regenerateQrCode(id));
  return data;
}
