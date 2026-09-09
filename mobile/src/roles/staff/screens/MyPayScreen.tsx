import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {Badge} from '../../../components/Badge';
import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {FadeIn} from '../../../components/FadeIn';
import {LoadingView} from '../../../components/LoadingView';
import {MonthNav} from '../../../components/MonthNav';
import {Screen} from '../../../components/Screen';
import {describeApiError} from '../../../api/errors';
import {useMyLogs} from '../../../features/attendance/hooks';
import {useMySummary} from '../../../features/payroll/hooks';
import {PAY_PERIOD_STAFF_HINT, PAY_PERIOD_STATUS_LABEL} from '../../../features/payroll/statusText';
import type {PayPeriodStatus} from '../../../features/payroll/types';
import {useMonthCursor} from '../../../hooks/useMonthCursor';
import {colors, spacing} from '../../../theme';
import {formatCurrency, formatDate, formatHours, formatTime} from '../../../utils/format';

const STATUS_TONE: Record<PayPeriodStatus, 'neutral' | 'success' | 'warning'> = {
  OPEN: 'neutral',
  LOCKED: 'warning',
  PAID: 'success',
};

/** One completed shift's worth of pay, for the daily breakdown below. */
type DayEntry = {
  date: string;
  clockIn: string;
  clockOut: string;
  hours: number;
  pay: number;
};

/**
 * Own hours, pay rates, and pay history, plus a day-by-day estimate for
 * whichever month is selected.
 *
 * The daily figures are an estimate, not the official one: pay is only ever
 * finalised per pay period (see PayrollEntry), where an admin's rate_1/
 * rate_2 split can differ from "every hour at rate_1", which is all a single
 * day has enough information to assume. The pay-period cards below remain
 * the real, reconciled numbers.
 */
export function MyPayScreen(): React.JSX.Element {
  const summary = useMySummary();
  const logs = useMyLogs({status: 'CLOSED'});
  const month = useMonthCursor();

  if (summary.isLoading || logs.isLoading) {
    return <LoadingView />;
  }

  if (summary.error || !summary.data || logs.error) {
    return (
      <ErrorState
        message={describeApiError(summary.error ?? logs.error, 'Could not load your pay.')}
        onRetry={() => {
          summary.refetch();
          logs.refetch();
        }}
      />
    );
  }

  const {pay_rates, pay_periods, totals} = summary.data;
  const rate1 = Number(pay_rates.rate_1 ?? 0);

  const dayEntries: DayEntry[] = (logs.data?.results ?? [])
    .filter(log => {
      if (!log.clock_out_at) {
        return false;
      }
      const clockIn = new Date(log.clock_in_at);
      return clockIn >= month.start && clockIn <= month.end;
    })
    .map(log => {
      const hours =
        (new Date(log.clock_out_at as string).getTime() - new Date(log.clock_in_at).getTime()) /
        3_600_000;
      return {
        date: log.clock_in_at,
        clockIn: log.clock_in_at,
        clockOut: log.clock_out_at as string,
        hours,
        pay: hours * rate1,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const monthHours = dayEntries.reduce((sum, entry) => sum + entry.hours, 0);
  const monthPay = dayEntries.reduce((sum, entry) => sum + entry.pay, 0);

  // Every official pay period whose payday (end date) falls in the selected
  // month - the same rule apps.payroll.services.pay_periods uses to decide
  // which month a period belongs to, so this list and the period's own
  // label ("Pay period 2 of September") never disagree.
  const periodsThisMonth = pay_periods
    .filter(entry => {
      const endsOn = new Date(entry.pay_period_ends_on);
      return endsOn >= month.start && endsOn <= month.end;
    })
    // The API returns periods newest-first (for the page as a whole); within
    // one month that shows period 2 before period 1, so re-sort oldest-first
    // here rather than trusting the overall order to also be right locally.
    .sort(
      (a, b) =>
        new Date(a.pay_period_starts_on).getTime() - new Date(b.pay_period_starts_on).getTime(),
    );
  const periodsMonthHours = periodsThisMonth.reduce(
    (sum, entry) => sum + Number(entry.hours_worked),
    0,
  );
  const periodsMonthPay = periodsThisMonth.reduce((sum, entry) => sum + Number(entry.total_pay), 0);

  return (
    <Screen onRefresh={() => summary.refetch()} refreshing={summary.isRefetching}>
      <Card>
        <Text style={styles.cardTitle}>Your rates</Text>
        <Text style={styles.rowBody}>
          Standard rate (first 40h/period):{' '}
          {pay_rates.rate_1 ? formatCurrency(pay_rates.rate_1) : 'Not set'}
        </Text>
        <Text style={styles.rowBody}>
          Overtime rate (after 40h/period):{' '}
          {pay_rates.rate_2 ? formatCurrency(pay_rates.rate_2) : 'Not set'}
        </Text>
        <Text style={styles.hint}>Set by your manager - ask them if these look wrong.</Text>
      </Card>

      <Text style={styles.sectionTitle}>Day by day (estimated)</Text>
      <Text style={styles.hint}>
        A running guess at each day's pay, at your standard rate. Your real pay is worked out per
        pay period below, once your manager finishes it.
      </Text>
      <MonthNav
        label={month.label}
        onPrevious={month.goPrevious}
        onNext={month.goNext}
        nextDisabled={month.isCurrentMonth}
      />

      {dayEntries.length === 0 ? (
        <EmptyState title="No completed shifts" body="Nothing worked and clocked out yet." />
      ) : (
        <>
          {dayEntries.map((entry, index) => (
            <FadeIn key={`${entry.clockIn}-${index}`} delay={index * 40}>
              <Card style={styles.dayCard}>
                <View>
                  <Text style={styles.rowTitle}>
                    {new Date(entry.date).toLocaleDateString(undefined, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                  <Text style={styles.rowBody}>
                    {formatTime(entry.clockIn)} - {formatTime(entry.clockOut)}
                  </Text>
                </View>
                <View style={styles.dayPay}>
                  <Text style={styles.dayPayValue}>{formatCurrency(entry.pay)}</Text>
                  <Text style={styles.rowBody}>{formatHours(entry.hours)}</Text>
                </View>
              </Card>
            </FadeIn>
          ))}

          <Card style={styles.monthTotalCard}>
            <Text style={styles.rowTitle}>Month estimate</Text>
            <Text style={styles.monthTotalValue}>{formatCurrency(monthPay)}</Text>
            <Text style={styles.rowBody}>{formatHours(monthHours)} worked</Text>
          </Card>
        </>
      )}

      <Card>
        <Text style={styles.cardTitle}>Lifetime totals</Text>
        <Text style={styles.rowBody}>
          Hours worked: {formatHours(totals.hours_worked_lifetime)}
        </Text>
        <Text style={styles.rowBody}>Paid out: {formatCurrency(totals.total_pay_received)}</Text>
        <Text style={styles.rowBody}>Pending: {formatCurrency(totals.total_pay_pending)}</Text>
      </Card>

      <Text style={styles.sectionTitle}>Your pay periods - {month.label}</Text>
      <Text style={styles.hint}>
        Every 2 weeks your manager finishes a pay period, which locks in your hours and works out
        your real pay - that's the number that actually gets paid, not the day-by-day estimate
        above.
      </Text>
      {periodsThisMonth.length === 0 ? (
        <EmptyState
          title="No pay periods this month"
          body="They'll appear here once your manager opens one."
        />
      ) : (
        <>
          {periodsThisMonth.map((entry, index) => (
            <FadeIn key={entry.id} delay={index * 40}>
              <Card>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowTitle}>{entry.pay_period_label}</Text>
                  <Badge
                    label={PAY_PERIOD_STATUS_LABEL[entry.pay_period_status]}
                    tone={STATUS_TONE[entry.pay_period_status]}
                  />
                </View>
                <Text style={styles.rowBody}>
                  {formatDate(entry.pay_period_starts_on)} - {formatDate(entry.pay_period_ends_on)}
                </Text>
                <Text style={styles.periodHint}>
                  {PAY_PERIOD_STAFF_HINT[entry.pay_period_status]}
                </Text>
                <Text style={styles.rowBody}>
                  {formatHours(entry.hours_worked)} worked - {formatCurrency(entry.total_pay)}
                </Text>
                <Text style={styles.rowNote}>
                  {formatHours(entry.hours_at_rate_1)} standard @{' '}
                  {formatCurrency(entry.rate_1_snapshot)}/hr
                  {Number(entry.hours_at_rate_2) > 0 ? (
                    <>
                      {' + '}
                      {formatHours(entry.hours_at_rate_2)} overtime @{' '}
                      {formatCurrency(entry.rate_2_snapshot)}/hr
                    </>
                  ) : null}
                  {' = '}
                  {formatCurrency(entry.total_pay)}
                </Text>
              </Card>
            </FadeIn>
          ))}

          {periodsThisMonth.length > 1 ? (
            <Card style={styles.monthTotalCard}>
              <Text style={styles.rowTitle}>{month.label} total</Text>
              <Text style={styles.monthTotalValue}>{formatCurrency(periodsMonthPay)}</Text>
              <Text style={styles.rowBody}>{formatHours(periodsMonthHours)} worked</Text>
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: {fontSize: 14, fontWeight: '700', color: colors.text},
  sectionTitle: {fontSize: 14, fontWeight: '700', color: colors.textMuted, marginTop: spacing.sm},
  hint: {fontSize: 12, color: colors.textMuted, marginTop: spacing.xs},
  rowHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  rowTitle: {fontSize: 15, fontWeight: '600', color: colors.text},
  rowBody: {fontSize: 14, color: colors.textMuted},
  periodHint: {fontSize: 12, color: colors.textMuted, marginTop: spacing.xs / 2},
  rowNote: {fontSize: 12, color: colors.textMuted},
  dayCard: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  dayPay: {alignItems: 'flex-end'},
  dayPayValue: {fontSize: 16, fontWeight: '700', color: colors.primary},
  monthTotalCard: {borderColor: colors.primary, borderWidth: 1, alignItems: 'center'},
  monthTotalValue: {fontSize: 24, fontWeight: '700', color: colors.primary},
});
