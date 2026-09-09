import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {BarChart} from '../../../components/BarChart';
import {Card} from '../../../components/Card';
import {ErrorState} from '../../../components/ErrorState';
import {FadeIn} from '../../../components/FadeIn';
import {GridTile} from '../../../components/GridTile';
import {LoadingView} from '../../../components/LoadingView';
import {MonthNav} from '../../../components/MonthNav';
import {Screen} from '../../../components/Screen';
import {describeApiError} from '../../../api/errors';
import {computeLateness} from '../../../features/attendance/analytics';
import {useAttendanceLogs, useLiveLogs, useShifts} from '../../../features/attendance/hooks';
import type {AdminShift, AttendanceLog} from '../../../features/attendance/types';
import {useRates} from '../../../features/payroll/hooks';
import {useStaffAccounts} from '../../../features/staff/hooks';
import type {StaffAccount} from '../../../features/staff/types';
import {useMonthCursor} from '../../../hooks/useMonthCursor';
import type {AdminStackParamList} from '../../../navigation/types';
import {useAuthStore} from '../../../store/authStore';
import {colors, spacing} from '../../../theme';
import {formatCurrency, formatHours} from '../../../utils/format';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

type StaffTotals = {
  staff: StaffAccount;
  hours: number;
  cost: number;
  lateMinutes: number;
};

function computeTeamTotals(
  staff: StaffAccount[],
  logs: AttendanceLog[],
  shifts: AdminShift[],
  rate1ById: Map<string, number>,
  window: {start: Date; end: Date},
): StaffTotals[] {
  return staff.map(member => {
    const memberLogs = logs.filter(log => log.staff === member.id && log.clock_out_at);
    const memberShifts = shifts.filter(shift => shift.staff === member.id);

    const hours = memberLogs.reduce((sum, log) => {
      const clockIn = new Date(log.clock_in_at);
      if (clockIn < window.start || clockIn > window.end) {
        return sum;
      }
      return sum + (new Date(log.clock_out_at as string).getTime() - clockIn.getTime()) / 3_600_000;
    }, 0);

    const {totalLateMinutes} = computeLateness(memberLogs, memberShifts, window);

    return {
      staff: member,
      hours,
      cost: hours * (rate1ById.get(member.id) ?? 0),
      lateMinutes: totalLateMinutes,
    };
  });
}

/**
 * The manager's home tab - who's on shift right now, every staff member
 * compared side by side (cost, hours, lateness) for the selected month, and
 * a shortcut grid into the rest of the manager-only screens (rota, payroll,
 * the check-in code, notifications). This is the one screen that used to be
 * split across a separate "Manager" hub tab and this analytics page; now
 * that analytics is the tab bar's default/home tab, it carries both jobs.
 *
 * A bar per staff member, not a line, in the three comparison charts: this
 * is a comparison across people, not a trend over time - the shape a line
 * chart is for. Cost and hours get their own charts rather than one with
 * two y-axes, since they're different scales.
 */
export function TeamAnalyticsScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore(state => state.user);
  const month = useMonthCursor();
  const staff = useStaffAccounts();
  const rates = useRates();
  const logs = useAttendanceLogs({status: 'CLOSED'});
  const shifts = useShifts();
  const live = useLiveLogs();

  if (staff.isLoading || rates.isLoading || logs.isLoading || shifts.isLoading || live.isLoading) {
    return <LoadingView />;
  }
  if (staff.error || rates.error || logs.error || shifts.error || live.error) {
    return (
      <ErrorState
        message={describeApiError(
          staff.error ?? rates.error ?? logs.error ?? shifts.error ?? live.error,
          'Could not load team analytics.',
        )}
        onRetry={() => {
          staff.refetch();
          rates.refetch();
          logs.refetch();
          shifts.refetch();
          live.refetch();
        }}
      />
    );
  }

  const activeStaff = (staff.data?.results ?? []).filter(member => member.is_active);
  const rate1ById = new Map(
    (rates.data?.results ?? []).map(rate => [rate.staff, Number(rate.rate_1)]),
  );

  const totals = computeTeamTotals(
    activeStaff,
    logs.data?.results ?? [],
    shifts.data?.results ?? [],
    rate1ById,
    {start: month.start, end: month.end},
  );

  const byCost = [...totals].sort((a, b) => b.cost - a.cost);
  const byHours = [...totals].sort((a, b) => b.hours - a.hours);
  const byLateness = [...totals].sort((a, b) => b.lateMinutes - a.lateMinutes);
  const onShiftCount = live.data?.length ?? 0;

  return (
    <Screen onRefresh={() => live.refetch()} refreshing={live.isRefetching}>
      <Text style={styles.heading}>Hi, {user?.first_name}</Text>

      <FadeIn>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{onShiftCount}</Text>
          <Text style={styles.statLabel}>On shift now</Text>
        </Card>
      </FadeIn>

      <MonthNav label={month.label} onPrevious={month.goPrevious} onNext={month.goNext} />

      <Card>
        <Text style={styles.cardTitle}>Estimated cost by staff</Text>
        <Text style={styles.cardHint}>Actual hours worked this month, at rate 1.</Text>
        <BarChart
          data={byCost.map(t => ({label: t.staff.first_name, value: t.cost}))}
          barColor={colors.primary}
          valueFormatter={formatCurrency}
          showAllLabels
          emptyLabel="No completed shifts this month yet."
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Hours worked by staff</Text>
        <BarChart
          data={byHours.map(t => ({label: t.staff.first_name, value: t.hours}))}
          barColor={colors.success}
          valueFormatter={formatHours}
          showAllLabels
          emptyLabel="No completed shifts this month yet."
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Minutes late by staff</Text>
        <Text style={styles.cardHint}>
          Total minutes late across the month, so persistent lateness stands out even if any one day
          looks minor.
        </Text>
        <BarChart
          data={byLateness.map(t => ({label: t.staff.first_name, value: t.lateMinutes}))}
          barColor={colors.warning}
          unit="m"
          showAllLabels
          emptyLabel="No completed, rota-matched shifts this month yet."
        />
      </Card>

      <Text style={styles.heading}>Manage</Text>
      <View style={styles.grid}>
        <FadeIn delay={60} style={styles.tileWrap}>
          <GridTile
            icon="calendar-outline"
            label="Weekly rota"
            subtitle="Build the schedule"
            onPress={() => navigation.navigate('Rota')}
          />
        </FadeIn>
        <FadeIn delay={110} style={styles.tileWrap}>
          <GridTile
            icon="cash-outline"
            label="Payroll"
            subtitle="Pay periods"
            onPress={() => navigation.navigate('Payroll')}
          />
        </FadeIn>
        <FadeIn delay={160} style={styles.tileWrap}>
          <GridTile
            icon="qr-code-outline"
            label="Check-in QR"
            subtitle="Venue code"
            onPress={() => navigation.navigate('StaffBarcode')}
          />
        </FadeIn>
        <FadeIn delay={210} style={styles.tileWrap}>
          <GridTile
            icon="notifications-outline"
            label="Notifications"
            subtitle="Alerts & reminders"
            onPress={() => navigation.navigate('Notifications')}
          />
        </FadeIn>
        <FadeIn delay={260} style={styles.tileWrap}>
          <GridTile
            icon="swap-horizontal-outline"
            label="Swap requests"
            subtitle="Approve or decline"
            onPress={() => navigation.navigate('SwapRequests')}
          />
        </FadeIn>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.sm},
  statCard: {alignItems: 'center'},
  statValue: {fontSize: 28, fontWeight: '700', color: colors.primary},
  statLabel: {fontSize: 13, color: colors.textMuted},
  cardTitle: {fontSize: 14, fontWeight: '700', color: colors.text},
  cardHint: {fontSize: 12, color: colors.textMuted},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between'},
  tileWrap: {width: '48%'},
});
