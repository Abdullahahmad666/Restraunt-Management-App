import React from 'react';
import {StyleSheet, Text} from 'react-native';

import {BarChart, SplitBar} from '../../../components/BarChart';
import {Card} from '../../../components/Card';
import {ErrorState} from '../../../components/ErrorState';
import {LineChart} from '../../../components/LineChart';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {describeApiError} from '../../../api/errors';
import {computeLateness} from '../../../features/attendance/analytics';
import {useMyLogs, useMyShifts} from '../../../features/attendance/hooks';
import {useMySummary} from '../../../features/payroll/hooks';
import type {PayPeriodEntry} from '../../../features/payroll/types';
import {colors, spacing} from '../../../theme';
import {formatCurrency, formatHours} from '../../../utils/format';

/** Last N months of pay-period entries, summed to one point per month - the
 * same "which month a period belongs to" the labels already use (a period's
 * payday, not its start, decides the month), so this trend and the "Official
 * pay periods" list on My Pay never disagree about which month is which. */
const TREND_MONTHS = 6;

function monthlyTotals(entries: PayPeriodEntry[]): {
  label: string;
  hours: number;
  pay: number;
}[] {
  const byMonth = new Map<string, {label: string; hours: number; pay: number; sortKey: number}>();

  for (const entry of entries) {
    const endsOn = new Date(entry.pay_period_ends_on);
    const key = `${endsOn.getFullYear()}-${endsOn.getMonth()}`;
    const existing = byMonth.get(key);
    const hours = Number(entry.hours_worked);
    const pay = Number(entry.total_pay);

    if (existing) {
      existing.hours += hours;
      existing.pay += pay;
    } else {
      byMonth.set(key, {
        label: endsOn.toLocaleDateString(undefined, {month: 'short'}),
        hours,
        pay,
        sortKey: endsOn.getFullYear() * 12 + endsOn.getMonth(),
      });
    }
  }

  return Array.from(byMonth.values())
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(-TREND_MONTHS);
}

/** Punctuality this month: how many minutes late in total, day by day, and
 * what share of check-ins were on time - plus how hours and pay have
 * trended over recent months. */
export function AnalyticsScreen(): React.JSX.Element {
  const shifts = useMyShifts();
  const logs = useMyLogs({status: 'CLOSED'});
  const summary = useMySummary();

  if (shifts.isLoading || logs.isLoading || summary.isLoading) {
    return <LoadingView />;
  }
  if (shifts.error || logs.error || summary.error) {
    return (
      <ErrorState
        message={describeApiError(
          shifts.error ?? logs.error ?? summary.error,
          'Could not load your analytics.',
        )}
        onRetry={() => {
          shifts.refetch();
          logs.refetch();
          summary.refetch();
        }}
      />
    );
  }

  const trend = monthlyTotals(summary.data?.pay_periods ?? []);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const monthLabel = monthStart.toLocaleDateString(undefined, {month: 'long', year: 'numeric'});

  const {daily, totalLateMinutes, onTimeCount, lateCount} = computeLateness(
    logs.data?.results ?? [],
    shifts.data?.results ?? [],
    {start: monthStart, end: monthEnd},
  );

  return (
    <Screen>
      <Text style={styles.monthLabel}>{monthLabel}</Text>

      <Card style={styles.heroCard}>
        <Text style={styles.heroLabel}>Late this month</Text>
        <Text style={styles.heroValue}>{totalLateMinutes} min</Text>
        <Text style={styles.heroHint}>
          {lateCount === 0
            ? 'Every check-in on time so far.'
            : `Across ${lateCount} late check-in${lateCount === 1 ? '' : 's'}.`}
        </Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>On time vs late</Text>
        <SplitBar
          goodCount={onTimeCount}
          poorCount={lateCount}
          goodLabel="On time"
          poorLabel="Late"
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Minutes late by check-in</Text>
        <Text style={styles.cardHint}>
          Each bar is one check-in - its height is how late it was against your scheduled start.
        </Text>
        <BarChart
          data={daily.map(d => ({label: d.label, value: d.lateMinutes}))}
          barColor={colors.warning}
          unit="m"
          emptyLabel="No completed shifts with a matching rota entry yet this month."
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Hours worked per month</Text>
        <LineChart
          data={trend.map(m => ({label: m.label, value: m.hours}))}
          lineColor={colors.primary}
          valueFormatter={formatHours}
          emptyLabel="Not enough closed pay periods yet to show a trend."
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Pay per month</Text>
        <LineChart
          data={trend.map(m => ({label: m.label, value: m.pay}))}
          lineColor={colors.success}
          valueFormatter={formatCurrency}
          emptyLabel="Not enough closed pay periods yet to show a trend."
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthLabel: {fontSize: 16, fontWeight: '700', color: colors.text},
  heroCard: {borderColor: colors.primary, borderWidth: 1, alignItems: 'center'},
  heroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroValue: {fontSize: 32, fontWeight: '700', color: colors.text},
  heroHint: {fontSize: 13, color: colors.textMuted},
  cardTitle: {fontSize: 14, fontWeight: '700', color: colors.text},
  cardHint: {fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm},
});
