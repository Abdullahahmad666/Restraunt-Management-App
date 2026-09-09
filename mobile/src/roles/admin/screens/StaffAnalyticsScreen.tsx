import React from 'react';
import {StyleSheet, Text} from 'react-native';
import {useRoute, type RouteProp} from '@react-navigation/native';

import {BarChart, SplitBar} from '../../../components/BarChart';
import {Card} from '../../../components/Card';
import {ErrorState} from '../../../components/ErrorState';
import {LoadingView} from '../../../components/LoadingView';
import {MonthNav} from '../../../components/MonthNav';
import {Screen} from '../../../components/Screen';
import {describeApiError} from '../../../api/errors';
import {useAttendanceLogs, useShifts} from '../../../features/attendance/hooks';
import {computeLateness} from '../../../features/attendance/analytics';
import {useMonthCursor} from '../../../hooks/useMonthCursor';
import {colors, spacing} from '../../../theme';
import type {AdminStackParamList} from '../../../navigation/types';

type Route = RouteProp<AdminStackParamList, 'StaffAnalytics'>;

/** A manager's view of one staff member's punctuality, any month - the same
 * figures the staff member sees for themselves (see AnalyticsScreen), just
 * with month navigation instead of being pinned to the current one. */
export function StaffAnalyticsScreen(): React.JSX.Element {
  const {params} = useRoute<Route>();
  const month = useMonthCursor();
  const shifts = useShifts({staff: params.staffId});
  const logs = useAttendanceLogs({staff: params.staffId, status: 'CLOSED'});

  if (shifts.isLoading || logs.isLoading) {
    return <LoadingView />;
  }
  if (shifts.error || logs.error) {
    return (
      <ErrorState
        message={describeApiError(shifts.error ?? logs.error, 'Could not load analytics.')}
        onRetry={() => {
          shifts.refetch();
          logs.refetch();
        }}
      />
    );
  }

  const {daily, totalLateMinutes, onTimeCount, lateCount} = computeLateness(
    logs.data?.results ?? [],
    shifts.data?.results ?? [],
    {start: month.start, end: month.end},
  );

  return (
    <Screen>
      <MonthNav label={month.label} onPrevious={month.goPrevious} onNext={month.goNext} />

      <Card style={styles.heroCard}>
        <Text style={styles.heroLabel}>Total late</Text>
        <Text style={styles.heroValue}>{totalLateMinutes} min</Text>
        <Text style={styles.heroHint}>
          {lateCount === 0
            ? 'Every check-in on time.'
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
        <BarChart
          data={daily.map(d => ({label: d.label, value: d.lateMinutes}))}
          barColor={colors.warning}
          unit="m"
          emptyLabel="No completed shifts with a matching rota entry this month."
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  cardTitle: {fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: spacing.sm},
});
