/** react-query wrappers: scan, my history, who is checked in, the rota. */
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import * as api from './api';
import type {
  AttendanceLogCorrection,
  AttendanceStatus,
  ScanRequest,
  ShiftSwapStatus,
} from './types';

const keys = {
  myShifts: ['attendance', 'my-shifts'] as const,
  myLogs: (params?: {status?: AttendanceStatus}) => ['attendance', 'my-logs', params] as const,
  live: ['attendance', 'live'] as const,
  logs: (params?: {staff?: string; status?: string}) => ['attendance', 'logs', params] as const,
  log: (id: string) => ['attendance', 'log', id] as const,
  shifts: (params?: {staff?: string}) => ['attendance', 'shifts', params] as const,
  qrCodes: ['attendance', 'qr-codes'] as const,
  colleagues: ['attendance', 'colleagues'] as const,
  myShiftSwapRequests: ['attendance', 'my-shift-swap-requests'] as const,
  shiftSwapRequests: (params?: {status?: ShiftSwapStatus}) =>
    ['attendance', 'shift-swap-requests', params] as const,
};

export function useMyShifts() {
  return useQuery({queryKey: keys.myShifts, queryFn: api.myShifts});
}

export function useMyLogs(params?: {status?: AttendanceStatus}) {
  return useQuery({queryKey: keys.myLogs(params), queryFn: () => api.myLogs(params)});
}

export function useUpdateMyLogNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({id, note}: {id: string; note: string}) => api.updateMyLogNote(id, note),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['attendance', 'my-logs']}),
  });
}

export function useScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: ScanRequest) => api.scan(request),
    onSuccess: () => {
      // Prefix match: invalidates every status-filtered variant, not just
      // the unfiltered list.
      queryClient.invalidateQueries({queryKey: ['attendance', 'my-logs']});
      queryClient.invalidateQueries({queryKey: keys.live});
    },
  });
}

export function useLiveLogs() {
  return useQuery({queryKey: keys.live, queryFn: api.liveLogs, refetchInterval: 30_000});
}

export function useAttendanceLogs(params?: {staff?: string; status?: string}) {
  return useQuery({queryKey: keys.logs(params), queryFn: () => api.listLogs(params)});
}

export function useAttendanceLog(id: string) {
  return useQuery({queryKey: keys.log(id), queryFn: () => api.getLog(id)});
}

export function useUpdateLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({id, correction}: {id: string; correction: AttendanceLogCorrection}) =>
      api.updateLog(id, correction),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['attendance']});
    },
  });
}

export function useShifts(params?: {staff?: string}) {
  return useQuery({queryKey: keys.shifts(params), queryFn: () => api.listShifts(params)});
}

export function useCreateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createShift,
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['attendance']}),
  });
}

export function useUpdateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: api.UpdateShiftInput}) =>
      api.updateShift(id, input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['attendance']}),
  });
}

export function useDeleteShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteShift,
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['attendance']}),
  });
}

export function useVenueQrCodes() {
  return useQuery({queryKey: keys.qrCodes, queryFn: api.venueQrCodes});
}

export function useRegenerateVenueQrCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.regenerateVenueQrCode,
    onSuccess: () => queryClient.invalidateQueries({queryKey: keys.qrCodes}),
  });
}

export function useCreateVenueQrCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createVenueQrCode,
    onSuccess: () => queryClient.invalidateQueries({queryKey: keys.qrCodes}),
  });
}

// ---------------------------------------------------------------------------
// Shift swaps
// ---------------------------------------------------------------------------

export function useColleagues() {
  return useQuery({queryKey: keys.colleagues, queryFn: api.colleagues});
}

export function useMyShiftSwapRequests() {
  return useQuery({queryKey: keys.myShiftSwapRequests, queryFn: api.myShiftSwapRequests});
}

export function useCreateShiftSwapRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createShiftSwapRequest,
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['attendance']}),
  });
}

export function useCancelShiftSwapRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.cancelShiftSwapRequest,
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['attendance']}),
  });
}

export function useShiftSwapRequests(params?: {status?: ShiftSwapStatus}) {
  return useQuery({
    queryKey: keys.shiftSwapRequests(params),
    queryFn: () => api.listShiftSwapRequests(params),
  });
}

export function useApproveShiftSwapRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.approveShiftSwapRequest,
    // Approving reassigns the shift - invalidate the whole domain rather
    // than just the swap-request lists, so both the rota and my-shifts
    // (on whichever device happens to be looking) pick up the change too.
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['attendance']}),
  });
}

export function useDeclineShiftSwapRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({id, decisionNote}: {id: string; decisionNote?: string}) =>
      api.declineShiftSwapRequest(id, decisionNote),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['attendance']}),
  });
}
