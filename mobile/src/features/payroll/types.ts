/** PayrollEntry, PayPeriod, StaffPayRate and staff-summary shapes. */
import type {Shift} from '../attendance/types';

export type PayPeriodStatus = 'OPEN' | 'LOCKED' | 'PAID';

export type PayPeriod = {
  id: string;
  restaurant: string;
  starts_on: string;
  ends_on: string;
  status: PayPeriodStatus;
};

export type PayrollEntry = {
  id: string;
  pay_period: string;
  staff: string;
  hours_worked: string;
  hours_at_rate_1: string;
  hours_at_rate_2: string;
  rate_1_snapshot: string;
  rate_2_snapshot: string;
  total_pay: string;
};

/** Same as PayrollEntry but with the period's own dates/status flattened in -
 * what the staff-summary endpoints return under `pay_periods`. */
export type PayPeriodEntry = PayrollEntry & {
  pay_period_starts_on: string;
  pay_period_ends_on: string;
  pay_period_status: PayPeriodStatus;
};

export type StaffPayRate = {
  id: string;
  staff: string;
  rate_1: string;
  rate_2: string;
};

export type StaffSummary = {
  staff: {id: string; name: string; email: string};
  pay_rates: {rate_1: string | null; rate_2: string | null};
  range: {start: string; end: string};
  shifts: Shift[];
  off_days: string[];
  pay_periods: PayPeriodEntry[];
  totals: {
    hours_worked_lifetime: string;
    total_pay_received: string;
    total_pay_pending: string;
  };
};

export type StaffCostRow = {
  staff_id: string;
  staff_name: string;
  hours: string;
  total_pay: string;
};

export type StaffCostReport = {
  year: number;
  month: number;
  total: string;
  by_staff: StaffCostRow[];
};
