import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {Badge} from '../../../components/Badge';
import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {describeApiError} from '../../../api/errors';
import {useMySummary} from '../../../features/payroll/hooks';
import type {PayPeriodStatus} from '../../../features/payroll/types';
import {colors, spacing} from '../../../theme';
import {formatCurrency, formatDate, formatHours} from '../../../utils/format';

const STATUS_TONE: Record<PayPeriodStatus, 'neutral' | 'success' | 'warning'> = {
  OPEN: 'neutral',
  LOCKED: 'warning',
  PAID: 'success',
};

/** Own hours, pay rates, and pay history - one call, the staff-summary endpoint. */
export function MyPayScreen(): React.JSX.Element {
  const summary = useMySummary();

  if (summary.isLoading) {
    return <LoadingView />;
  }

  if (summary.error || !summary.data) {
    return (
      <ErrorState
        message={describeApiError(summary.error, 'Could not load your pay.')}
        onRetry={() => summary.refetch()}
      />
    );
  }

  const {pay_rates, pay_periods, totals} = summary.data;

  return (
    <Screen onRefresh={() => summary.refetch()} refreshing={summary.isRefetching}>
      <Card>
        <Text style={styles.cardTitle}>Your rates</Text>
        <Text style={styles.rowBody}>
          Rate 1: {pay_rates.rate_1 ? formatCurrency(pay_rates.rate_1) : 'Not set'}
        </Text>
        <Text style={styles.rowBody}>
          Rate 2: {pay_rates.rate_2 ? formatCurrency(pay_rates.rate_2) : 'Not set'}
        </Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Lifetime totals</Text>
        <Text style={styles.rowBody}>
          Hours worked: {formatHours(totals.hours_worked_lifetime)}
        </Text>
        <Text style={styles.rowBody}>Paid out: {formatCurrency(totals.total_pay_received)}</Text>
        <Text style={styles.rowBody}>Pending: {formatCurrency(totals.total_pay_pending)}</Text>
      </Card>

      <Text style={styles.sectionTitle}>Pay periods</Text>
      {pay_periods.length === 0 ? (
        <EmptyState title="No pay periods yet" body="They'll appear here once one is opened." />
      ) : (
        pay_periods.map(entry => (
          <Card key={entry.id}>
            <View style={styles.rowHeader}>
              <Text style={styles.rowTitle}>
                {formatDate(entry.pay_period_starts_on)} - {formatDate(entry.pay_period_ends_on)}
              </Text>
              <Badge label={entry.pay_period_status} tone={STATUS_TONE[entry.pay_period_status]} />
            </View>
            <Text style={styles.rowBody}>
              {formatHours(entry.hours_worked)} worked - {formatCurrency(entry.total_pay)}
            </Text>
            <Text style={styles.rowNote}>
              {formatHours(entry.hours_at_rate_1)} @ {formatCurrency(entry.rate_1_snapshot)} +{' '}
              {formatHours(entry.hours_at_rate_2)} @ {formatCurrency(entry.rate_2_snapshot)}
            </Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: {fontSize: 14, fontWeight: '700', color: colors.text},
  sectionTitle: {fontSize: 14, fontWeight: '700', color: colors.textMuted, marginTop: spacing.sm},
  rowHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  rowTitle: {fontSize: 15, fontWeight: '600', color: colors.text},
  rowBody: {fontSize: 14, color: colors.textMuted},
  rowNote: {fontSize: 12, color: colors.textMuted},
});
