/** Calls to /staff/{scan,shifts,logs,colleagues,shift-swap-requests}/ and
 * /admin/{shifts,logs,qr-codes,shift-swap-requests}/. */
import {apiClient} from '../../api/client';
import {endpoints} from '../../api/endpoints';
import type {Paginated} from '../../types/api';
import type {
  AdminShift,
  AttendanceLog,
  AttendanceLogCorrection,
  AttendanceStatus,
  Colleague,
  JobTitle,
  ScanRequest,
  ScanResponse,
  Shift,
  ShiftSwapRequest,
  ShiftSwapStatus,
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

export async function myLogs(params?: {
  status?: AttendanceStatus;
}): Promise<Paginated<AttendanceLog>> {
  const {data} = await apiClient.get<Paginated<AttendanceLog>>(endpoints.staff.attendance.logs, {
    params,
  });
  return data;
}

/** The only thing a staff member may write on their own log - see
 * StaffAttendanceLogSerializer, which rejects anything else here. */
export async function updateMyLogNote(id: string, note: string): Promise<AttendanceLog> {
  const {data} = await apiClient.patch<AttendanceLog>(endpoints.staff.attendance.log(id), {note});
  return data;
}

/** Other active staff at the caller's own restaurant - who a shift can be
 * offered to. */
export async function colleagues(): Promise<Paginated<Colleague>> {
  const {data} = await apiClient.get<Paginated<Colleague>>(endpoints.staff.attendance.colleagues);
  return data;
}

/** The caller's own swap requests - both the ones they made and the ones
 * asking them to cover someone else's shift. */
export async function myShiftSwapRequests(): Promise<Paginated<ShiftSwapRequest>> {
  const {data} = await apiClient.get<Paginated<ShiftSwapRequest>>(
    endpoints.staff.attendance.shiftSwapRequests,
  );
  return data;
}

export async function createShiftSwapRequest(input: {
  shift: string;
  target_staff: string;
  note?: string;
}): Promise<ShiftSwapRequest> {
  const {data} = await apiClient.post<ShiftSwapRequest>(
    endpoints.staff.attendance.shiftSwapRequests,
    input,
  );
  return data;
}

export async function cancelShiftSwapRequest(id: string): Promise<ShiftSwapRequest> {
  const {data} = await apiClient.post<ShiftSwapRequest>(
    endpoints.staff.attendance.cancelShiftSwapRequest(id),
  );
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
  job_title?: JobTitle | '';
  notes?: string;
};

export async function createShift(input: CreateShiftInput): Promise<AdminShift> {
  const {data} = await apiClient.post<AdminShift>(endpoints.admin.attendance.shifts, input);
  return data;
}

export type UpdateShiftInput = Partial<CreateShiftInput>;

export async function updateShift(id: string, input: UpdateShiftInput): Promise<AdminShift> {
  const {data} = await apiClient.patch<AdminShift>(endpoints.admin.attendance.shift(id), input);
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

export async function listShiftSwapRequests(params?: {
  status?: ShiftSwapStatus;
}): Promise<Paginated<ShiftSwapRequest>> {
  const {data} = await apiClient.get<Paginated<ShiftSwapRequest>>(
    endpoints.admin.attendance.shiftSwapRequests,
    {params},
  );
  return data;
}

export async function approveShiftSwapRequest(id: string): Promise<ShiftSwapRequest> {
  const {data} = await apiClient.post<ShiftSwapRequest>(
    endpoints.admin.attendance.approveShiftSwapRequest(id),
  );
  return data;
}

export async function declineShiftSwapRequest(
  id: string,
  decision_note?: string,
): Promise<ShiftSwapRequest> {
  const {data} = await apiClient.post<ShiftSwapRequest>(
    endpoints.admin.attendance.declineShiftSwapRequest(id),
    {decision_note},
  );
  return data;
}
