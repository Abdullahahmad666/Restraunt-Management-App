/** react-query wrappers: my pay, rates, pay periods, entries, cost report. */
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import * as api from './api';

const keys = {
  myEntries: ['payroll', 'my-entries'] as const,
  mySummary: (params?: {start?: string; end?: string}) =>
    ['payroll', 'my-summary', params] as const,
  rates: ['payroll', 'rates'] as const,
  periods: ['payroll', 'periods'] as const,
  periodEntries: (id: string) => ['payroll', 'periods', id, 'entries'] as const,
  entries: (params?: {staff?: string; pay_period?: string}) =>
    ['payroll', 'entries', params] as const,
  costReport: (year: number, month: number) => ['payroll', 'cost-report', year, month] as const,
  staffSummary: (staffId: string, params?: {start?: string; end?: string}) =>
    ['payroll', 'staff-summary', staffId, params] as const,
};

export function useMyEntries() {
  return useQuery({queryKey: keys.myEntries, queryFn: api.myEntries});
}

export function useMySummary(params?: {start?: string; end?: string}) {
  return useQuery({queryKey: keys.mySummary(params), queryFn: () => api.mySummary(params)});
}

export function useStaffSummary(staffId: string, params?: {start?: string; end?: string}) {
  return useQuery({
    queryKey: keys.staffSummary(staffId, params),
    queryFn: () => api.staffSummary(staffId, params),
    enabled: Boolean(staffId),
  });
}

export function useRates() {
  return useQuery({queryKey: keys.rates, queryFn: api.listRates});
}

export function useSetRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({existingId, ...input}: api.SetRateInput & {existingId?: string}) =>
      existingId ? api.updateRate(existingId, input) : api.createRate(input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: keys.rates}),
  });
}

export function usePeriods() {
  return useQuery({queryKey: keys.periods, queryFn: api.listPeriods});
}

export function useCreatePeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createPeriod,
    onSuccess: () => queryClient.invalidateQueries({queryKey: keys.periods}),
  });
}

export function useClosePeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.closePeriod,
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['payroll']}),
  });
}

export function useMarkPeriodPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.markPeriodPaid,
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['payroll']}),
  });
}

export function usePeriodEntries(id: string | null) {
  return useQuery({
    queryKey: keys.periodEntries(id ?? ''),
    queryFn: () => api.periodEntries(id as string),
    enabled: Boolean(id),
  });
}

export function useEntries(params?: {staff?: string; pay_period?: string}) {
  return useQuery({queryKey: keys.entries(params), queryFn: () => api.listEntries(params)});
}

export function useReallocateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({id, ...input}: {id: string; hours_at_rate_1: string; hours_at_rate_2: string}) =>
      api.reallocateEntry(id, input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['payroll']}),
  });
}

export function useCostReport(year: number, month: number) {
  return useQuery({
    queryKey: keys.costReport(year, month),
    queryFn: () => api.costReport(year, month),
  });
}
