import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {Badge} from '../../../components/Badge';
import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {FadeIn} from '../../../components/FadeIn';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {TextField} from '../../../components/TextField';
import {describeApiError} from '../../../api/errors';
import {useAttendanceLogs} from '../../../features/attendance/hooks';
import {
  useClosePeriod,
  useCostReport,
  useGenerateNextPeriod,
  useMarkPeriodPaid,
  usePeriodEntries,
  usePeriods,
  useRates,
} from '../../../features/payroll/hooks';
import {
  PAY_PERIOD_MANAGER_HINT,
  PAY_PERIOD_STATUS_LABEL,
} from '../../../features/payroll/statusText';
import type {PayPeriod, PayPeriodStatus} from '../../../features/payroll/types';
import {useStaffAccounts} from '../../../features/staff/hooks';
import {colors, spacing} from '../../../theme';
import {formatCurrency, formatDate, formatHours, fullName} from '../../../utils/format';

const STATUS_TONE: Record<PayPeriodStatus, 'neutral' | 'success' | 'warning'> = {
  OPEN: 'neutral',
  LOCKED: 'warning',
  PAID: 'success',
};

/** Whether this period is the one actually running right now - today falls
 * in its date range AND it's still open. Status wins over dates: a period
 * can't be "happening now" once it's been finished and paid, even if today
 * still happens to fall between its start and end (e.g. closed early). */
function isCurrentPeriod(period: PayPeriod): boolean {
  if (period.status !== 'OPEN') {
    return false;
  }
  const today = new Date().toISOString().slice(0, 10);
  return today >= period.starts_on && today <= period.ends_on;
}

/** Pay periods (open, close, mark paid) and the monthly staff-cost report. */
export function PayrollScreen(): React.JSX.Element {
  const periods = usePeriods();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Screen onRefresh={() => periods.refetch()} refreshing={periods.isRefetching}>
      <Text style={styles.heading}>Pay periods</Text>
      <HowItWorksCard />
      <GeneratePeriodButton />

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
        periods.data?.results.map((period, index) => (
          <FadeIn key={period.id} delay={index * 50}>
            <PeriodRow
              period={period}
              expanded={expandedId === period.id}
              onToggle={() => setExpandedId(expandedId === period.id ? null : period.id)}
            />
          </FadeIn>
        ))
      )}

      <Text style={styles.heading}>Monthly cost report</Text>
      <CostReportCard />
    </Screen>
  );
}

/** A plain, three-step explanation of the pay period lifecycle, always
 * visible above the list - so "OPEN / LOCKED / PAID" is never the first
 * thing a manager has to work out on their own. */
function HowItWorksCard(): React.JSX.Element {
  return (
    <Card style={styles.howItWorksCard}>
      <Text style={styles.cardTitle}>How this works</Text>
      <View style={styles.stepRow}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>1</Text>
        </View>
        <Text style={styles.stepText}>
          Every 2 weeks a new pay period opens on its own and starts collecting hours.
        </Text>
      </View>
      <View style={styles.stepRow}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>2</Text>
        </View>
        <Text style={styles.stepText}>
          When it ends, tap <Text style={styles.stepEmphasis}>Finish period</Text> to lock the hours
          in and work out how much everyone's owed.
        </Text>
      </View>
      <View style={styles.stepRow}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>3</Text>
        </View>
        <Text style={styles.stepText}>
          Once you've actually paid your staff (bank transfer, cash, however you do it), tap{' '}
          <Text style={styles.stepEmphasis}>Mark as paid</Text> to keep the record straight.
        </Text>
      </View>
    </Card>
  );
}

function GeneratePeriodButton(): React.JSX.Element {
  const generateNext = useGenerateNextPeriod();
  const [error, setError] = useState<string | null>(null);

  async function onPress() {
    setError(null);
    try {
      await generateNext.mutateAsync();
    } catch (err) {
      setError(describeApiError(err, 'Could not open the next pay period.'));
    }
  }

  return (
    <Card>
      <Text style={styles.hint}>
        Pay runs every two weeks, Friday to Thursday - the next one picks up exactly where the last
        one left off, so there's nothing to type in.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Open next pay period" onPress={onPress} loading={generateNext.isPending} />
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
  // An OPEN period has no PayrollEntry rows yet - those only get created
  // when it's finished (see close_pay_period) - so there is nothing for
  // this to fetch until then. OpenPeriodHours below covers that case
  // instead, from attendance logs directly.
  const entries = usePeriodEntries(expanded && period.status !== 'OPEN' ? period.id : null);
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
        <View style={styles.rowHeaderText}>
          <View style={styles.titleRow}>
            <Text style={styles.rowTitle}>{period.label}</Text>
            {isCurrentPeriod(period) ? <Badge label="Happening now" tone="success" /> : null}
          </View>
          <Text style={styles.entryRow}>
            {formatDate(period.starts_on)} - {formatDate(period.ends_on)}
          </Text>
        </View>
        <Badge label={PAY_PERIOD_STATUS_LABEL[period.status]} tone={STATUS_TONE[period.status]} />
      </Pressable>

      <Text style={styles.periodHint}>{PAY_PERIOD_MANAGER_HINT[period.status]}</Text>

      {expanded ? (
        <View style={styles.expanded}>
          {period.status === 'OPEN' ? (
            <OpenPeriodHours period={period} />
          ) : entries.isLoading ? (
            <LoadingView />
          ) : (
            entries.data?.map(entry => (
              <Text key={entry.id} style={styles.entryRow}>
                {entry.staff_name}: {formatHours(entry.hours_worked)} -{' '}
                {formatCurrency(entry.total_pay)}
              </Text>
            ))
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.formActions}>
            {period.status === 'OPEN' ? (
              <Button title="Finish period" onPress={onClose} loading={closePeriod.isPending} />
            ) : null}
            {period.status === 'LOCKED' ? (
              <Button title="Mark as paid" onPress={onMarkPaid} loading={markPaid.isPending} />
            ) : null}
          </View>
        </View>
      ) : (
        <Pressable onPress={onToggle}>
          <Text style={styles.detailsLink}>
            {period.status === 'OPEN' ? 'View hours so far' : 'View pay details'}
          </Text>
        </Pressable>
      )}
    </Card>
  );
}

/**
 * Hours worked so far this period, per staff member - for an OPEN period,
 * where there's no PayrollEntry yet to read from (those are only created
 * when the period is finished, see close_pay_period). Computed the same way
 * as the rest of the app's "estimate" figures: completed shifts within the
 * period's dates, at rate 1, clearly labelled as an estimate since the real
 * rate 1/rate 2 split only happens at close.
 */
function OpenPeriodHours({period}: {period: PayPeriod}): React.JSX.Element {
  const staff = useStaffAccounts();
  const rates = useRates();
  const logs = useAttendanceLogs({status: 'CLOSED'});

  if (staff.isLoading || rates.isLoading || logs.isLoading) {
    return <LoadingView />;
  }
  if (staff.error || rates.error || logs.error) {
    return (
      <ErrorState
        message={describeApiError(
          staff.error ?? rates.error ?? logs.error,
          'Could not load hours so far.',
        )}
      />
    );
  }

  const rate1ById = new Map(
    (rates.data?.results ?? []).map(rate => [rate.staff, Number(rate.rate_1)]),
  );
  const start = new Date(`${period.starts_on}T00:00:00`);
  const end = new Date(`${period.ends_on}T23:59:59`);

  const rows = (staff.data?.results ?? [])
    .filter(member => member.is_active)
    .map(member => {
      const hours = (logs.data?.results ?? [])
        .filter(log => log.staff === member.id && log.clock_out_at)
        .filter(log => {
          const clockIn = new Date(log.clock_in_at);
          return clockIn >= start && clockIn <= end;
        })
        .reduce(
          (sum, log) =>
            sum +
            (new Date(log.clock_out_at as string).getTime() - new Date(log.clock_in_at).getTime()) /
              3_600_000,
          0,
        );
      return {member, hours, pay: hours * (rate1ById.get(member.id) ?? 0)};
    })
    .filter(row => row.hours > 0)
    .sort((a, b) => b.hours - a.hours);

  if (rows.length === 0) {
    return <Text style={styles.entryRow}>No completed shifts in this period yet.</Text>;
  }

  return (
    <>
      {rows.map(row => (
        <Text key={row.member.id} style={styles.entryRow}>
          {fullName(row.member)}: {formatHours(row.hours)} - {formatCurrency(row.pay)} (estimated)
        </Text>
      ))}
    </>
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
      <Text style={styles.hint}>What all your staff cost you, month by month.</Text>
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
  cardTitle: {fontSize: 14, fontWeight: '700', color: colors.text},
  howItWorksCard: {gap: spacing.sm},
  stepRow: {flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start'},
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: {fontSize: 12, fontWeight: '700', color: '#FFFFFF'},
  stepText: {flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 18},
  stepEmphasis: {color: colors.text, fontWeight: '700'},
  rowHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  rowHeaderText: {flex: 1, gap: spacing.xs / 2},
  titleRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  rowTitle: {fontSize: 15, fontWeight: '600', color: colors.text},
  hint: {fontSize: 13, color: colors.textMuted},
  periodHint: {fontSize: 12, color: colors.textMuted, marginTop: spacing.xs},
  detailsLink: {fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: spacing.sm},
  entryRow: {fontSize: 13, color: colors.textMuted},
  expanded: {marginTop: spacing.sm, gap: spacing.sm},
  formActions: {flexDirection: 'row', gap: spacing.sm},
  smallInput: {width: 90},
  error: {color: colors.danger},
});
