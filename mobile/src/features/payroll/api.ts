/** Calls to /staff/{entries,summary}/ and /admin/{rates,periods,entries,cost-report,staff-summary}/. */
import {apiClient} from '../../api/client';
import {endpoints} from '../../api/endpoints';
import type {Paginated} from '../../types/api';
import type {PayPeriod, PayrollEntry, StaffCostReport, StaffPayRate, StaffSummary} from './types';

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export async function myEntries(): Promise<Paginated<PayrollEntry>> {
  const {data} = await apiClient.get<Paginated<PayrollEntry>>(endpoints.staff.payroll.entries);
  return data;
}

export async function mySummary(params?: {start?: string; end?: string}): Promise<StaffSummary> {
  const {data} = await apiClient.get<StaffSummary>(endpoints.staff.payroll.summary, {params});
  return data;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function listRates(): Promise<Paginated<StaffPayRate>> {
  const {data} = await apiClient.get<Paginated<StaffPayRate>>(endpoints.admin.payroll.rates);
  return data;
}

export type SetRateInput = {staff: string; rate_1: string; rate_2: string};

export async function createRate(input: SetRateInput): Promise<StaffPayRate> {
  const {data} = await apiClient.post<StaffPayRate>(endpoints.admin.payroll.rates, input);
  return data;
}

export async function updateRate(id: string, input: Partial<SetRateInput>): Promise<StaffPayRate> {
  const {data} = await apiClient.patch<StaffPayRate>(endpoints.admin.payroll.rate(id), input);
  return data;
}

export async function listPeriods(): Promise<Paginated<PayPeriod>> {
  const {data} = await apiClient.get<Paginated<PayPeriod>>(endpoints.admin.payroll.periods);
  return data;
}

export async function createPeriod(input: {
  restaurant: string;
  starts_on: string;
  ends_on: string;
}): Promise<PayPeriod> {
  const {data} = await apiClient.post<PayPeriod>(endpoints.admin.payroll.periods, input);
  return data;
}

export async function closePeriod(id: string): Promise<PayPeriod> {
  const {data} = await apiClient.post<PayPeriod>(endpoints.admin.payroll.closePeriod(id));
  return data;
}

export async function markPeriodPaid(id: string): Promise<PayPeriod> {
  const {data} = await apiClient.post<PayPeriod>(endpoints.admin.payroll.markPeriodPaid(id));
  return data;
}

export async function periodEntries(id: string): Promise<PayrollEntry[]> {
  const {data} = await apiClient.get<PayrollEntry[]>(endpoints.admin.payroll.periodEntries(id));
  return data;
}

export async function listEntries(params?: {
  staff?: string;
  pay_period?: string;
}): Promise<Paginated<PayrollEntry>> {
  const {data} = await apiClient.get<Paginated<PayrollEntry>>(endpoints.admin.payroll.entries, {
    params,
  });
  return data;
}

export async function reallocateEntry(
  id: string,
  input: {hours_at_rate_1: string; hours_at_rate_2: string},
): Promise<PayrollEntry> {
  const {data} = await apiClient.patch<PayrollEntry>(
    endpoints.admin.payroll.reallocateEntry(id),
    input,
  );
  return data;
}

export async function costReport(year: number, month: number): Promise<StaffCostReport> {
  const {data} = await apiClient.get<StaffCostReport>(endpoints.admin.payroll.costReport, {
    params: {year, month},
  });
  return data;
}

export async function staffSummary(
  staffId: string,
  params?: {start?: string; end?: string},
): Promise<StaffSummary> {
  const {data} = await apiClient.get<StaffSummary>(endpoints.admin.payroll.staffSummary(staffId), {
    params,
  });
  return data;
}
