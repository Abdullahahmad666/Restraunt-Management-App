/** react-query wrappers: scan, my history, who is checked in, the rota. */
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import * as api from './api';
import type {AttendanceLogCorrection, ScanRequest} from './types';

const keys = {
  myShifts: ['attendance', 'my-shifts'] as const,
  myLogs: ['attendance', 'my-logs'] as const,
  live: ['attendance', 'live'] as const,
  logs: (params?: {staff?: string; status?: string}) => ['attendance', 'logs', params] as const,
  log: (id: string) => ['attendance', 'log', id] as const,
  shifts: (params?: {staff?: string}) => ['attendance', 'shifts', params] as const,
  qrCodes: ['attendance', 'qr-codes'] as const,
};

export function useMyShifts() {
  return useQuery({queryKey: keys.myShifts, queryFn: api.myShifts});
}

export function useMyLogs() {
  return useQuery({queryKey: keys.myLogs, queryFn: api.myLogs});
}

export function useScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: ScanRequest) => api.scan(request),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: keys.myLogs});
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
