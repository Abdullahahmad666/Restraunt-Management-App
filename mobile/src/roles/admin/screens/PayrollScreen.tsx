import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {Badge} from '../../../components/Badge';
import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {TextField} from '../../../components/TextField';
import {describeApiError} from '../../../api/errors';
import {
  useClosePeriod,
  useCostReport,
  useCreatePeriod,
  useMarkPeriodPaid,
  usePeriodEntries,
  usePeriods,
} from '../../../features/payroll/hooks';
import type {PayPeriod, PayPeriodStatus} from '../../../features/payroll/types';
import {useAuthStore} from '../../../store/authStore';
import {colors, spacing} from '../../../theme';
import {formatCurrency, formatDate, formatHours} from '../../../utils/format';

const STATUS_TONE: Record<PayPeriodStatus, 'neutral' | 'success' | 'warning'> = {
  OPEN: 'neutral',
  LOCKED: 'warning',
  PAID: 'success',
};

/** Pay periods (open, close, mark paid) and the monthly staff-cost report. */
export function PayrollScreen(): React.JSX.Element {
  const periods = usePeriods();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Screen onRefresh={() => periods.refetch()} refreshing={periods.isRefetching}>
      <Text style={styles.heading}>Pay periods</Text>
      <NewPeriodForm />

      {periods.isLoading ? (
        <LoadingView />
      ) : periods.error ? (
        <ErrorState
          message={describeApiError(periods.error, 'Could not load pay periods.')}
          onRetry={() => periods.refetch()}
        />
      ) : periods.data?.results.length === 0 ? (
        <EmptyState title="No pay periods yet" body="Open the first one above." />
      ) : (
        periods.data?.results.map(period => (
          <PeriodRow
            key={period.id}
            period={period}
            expanded={expandedId === period.id}
            onToggle={() => setExpandedId(expandedId === period.id ? null : period.id)}
          />
        ))
      )}

      <Text style={styles.heading}>Monthly cost report</Text>
      <CostReportCard />
    </Screen>
  );
}

function NewPeriodForm(): React.JSX.Element {
  const restaurant = useAuthStore(state => state.user?.restaurant);
  const createPeriod = useCreatePeriod();
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    if (!restaurant) {
      setError('No restaurant on this account.');
      return;
    }
    try {
      await createPeriod.mutateAsync({restaurant, starts_on: startsOn, ends_on: endsOn});
      setStartsOn('');
      setEndsOn('');
    } catch (err) {
      setError(describeApiError(err, 'Could not open this pay period.'));
    }
  }

  return (
    <Card>
      <TextField
        label="Starts on"
        placeholder="2026-08-01"
        value={startsOn}
        onChangeText={setStartsOn}
      />
      <TextField label="Ends on" placeholder="2026-08-15" value={endsOn} onChangeText={setEndsOn} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        title="Open period"
        onPress={onSubmit}
        loading={createPeriod.isPending}
        disabled={!startsOn || !endsOn}
      />
    </Card>
  );
}

function PeriodRow({
  period,
  expanded,
  onToggle,
}: {
  period: PayPeriod;
  expanded: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const closePeriod = useClosePeriod();
  const markPaid = useMarkPeriodPaid();
  const entries = usePeriodEntries(expanded ? period.id : null);
  const [error, setError] = useState<string | null>(null);

  async function onClose() {
    setError(null);
    try {
      await closePeriod.mutateAsync(period.id);
    } catch (err) {
      setError(describeApiError(err, 'Could not close this period.'));
    }
  }

  async function onMarkPaid() {
    setError(null);
    try {
      await markPaid.mutateAsync(period.id);
    } catch (err) {
      setError(describeApiError(err, 'Could not mark this period paid.'));
    }
  }

  return (
    <Card>
      <Pressable style={styles.rowHeader} onPress={onToggle}>
        <Text style={styles.rowTitle}>
          {formatDate(period.starts_on)} - {formatDate(period.ends_on)}
        </Text>
        <Badge label={period.status} tone={STATUS_TONE[period.status]} />
      </Pressable>

      {expanded ? (
        <View style={styles.expanded}>
          {entries.isLoading ? (
            <LoadingView />
          ) : (
            entries.data?.map(entry => (
              <Text key={entry.id} style={styles.entryRow}>
                {formatHours(entry.hours_worked)} - {formatCurrency(entry.total_pay)}
              </Text>
            ))
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.formActions}>
            {period.status === 'OPEN' ? (
              <Button title="Close & calculate" onPress={onClose} loading={closePeriod.isPending} />
            ) : null}
            {period.status === 'LOCKED' ? (
              <Button title="Mark paid" onPress={onMarkPaid} loading={markPaid.isPending} />
            ) : null}
          </View>
        </View>
      ) : null}
    </Card>
  );
}

function CostReportCard(): React.JSX.Element {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const report = useCostReport(
    Number(year) || now.getFullYear(),
    Number(month) || now.getMonth() + 1,
  );

  return (
    <Card>
      <View style={styles.formActions}>
        <TextField
          label="Year"
          keyboardType="number-pad"
          value={year}
          onChangeText={setYear}
          style={styles.smallInput}
        />
        <TextField
          label="Month"
          keyboardType="number-pad"
          value={month}
          onChangeText={setMonth}
          style={styles.smallInput}
        />
      </View>

      {report.isLoading ? (
        <LoadingView />
      ) : report.error ? (
        <ErrorState message={describeApiError(report.error, 'Could not load the cost report.')} />
      ) : (
        <>
          <Text style={styles.rowTitle}>Total: {formatCurrency(report.data?.total ?? 0)}</Text>
          {report.data?.by_staff.map(row => (
            <Text key={row.staff_id} style={styles.entryRow}>
              {row.staff_name}: {formatHours(row.hours)} - {formatCurrency(row.total_pay)}
            </Text>
          ))}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.sm},
  rowHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  rowTitle: {fontSize: 15, fontWeight: '600', color: colors.text},
  entryRow: {fontSize: 13, color: colors.textMuted},
  expanded: {marginTop: spacing.sm, gap: spacing.sm},
  formActions: {flexDirection: 'row', gap: spacing.sm},
  smallInput: {width: 90},
  error: {color: colors.danger},
});
