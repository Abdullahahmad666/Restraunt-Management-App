import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Badge} from '../../../components/Badge';
import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {FadeIn} from '../../../components/FadeIn';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {describeApiError} from '../../../api/errors';
import {useMyShifts} from '../../../features/attendance/hooks';
import {JOB_TITLE_LABELS} from '../../../features/attendance/types';
import type {Shift} from '../../../features/attendance/types';
import type {StaffStackParamList} from '../../../navigation/types';
import {colors, spacing} from '../../../theme';
import {formatTime} from '../../../utils/format';

type Nav = NativeStackNavigationProp<StaffStackParamList>;

/** Next month's rota is usually published a few days before month-end - once
 * it's day 26 or later, it's worth showing alongside what's left of this
 * month rather than making someone wait for the 1st. */
const NEXT_MONTH_PREVIEW_FROM_DAY = 26;

function ShiftCard({shift, delay}: {shift: Shift; delay: number}): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  // Only a shift that hasn't started yet can be offered - see
  // apps.attendance.services.swap.request_swap on the backend, which
  // rejects the same thing server-side.
  const canOffer = new Date(shift.starts_at) > new Date();

  return (
    <FadeIn delay={delay}>
      <Card>
        <View style={styles.rowHeader}>
          <View>
            <Text style={styles.day}>
              {new Date(shift.starts_at).toLocaleDateString(undefined, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </Text>
            <Text style={styles.time}>
              {formatTime(shift.starts_at)} - {formatTime(shift.ends_at)}
            </Text>
          </View>
          {shift.job_title ? (
            <Badge label={JOB_TITLE_LABELS[shift.job_title]} tone="neutral" />
          ) : null}
        </View>
        {shift.notes ? <Text style={styles.notes}>{shift.notes}</Text> : null}
        {canOffer ? (
          <Pressable onPress={() => navigation.navigate('RequestSwap', {shift})}>
            <Text style={styles.offerLink}>Can't make it? Offer this shift</Text>
          </Pressable>
        ) : null}
      </Card>
    </FadeIn>
  );
}

function totalHoursOf(shifts: Shift[]): number {
  return shifts.reduce((sum, shift) => {
    const hours =
      (new Date(shift.ends_at).getTime() - new Date(shift.starts_at).getTime()) / 3_600_000;
    return sum + hours;
  }, 0);
}

/** This month's rota only - no history to page back through here, that's
 * what Scan History is for. Next month's shifts join in automatically once
 * they'd realistically have been published. */
export function MyShiftsScreen(): React.JSX.Element {
  const shifts = useMyShifts();

  if (shifts.isLoading) {
    return <LoadingView />;
  }
  if (shifts.error) {
    return (
      <ErrorState
        message={describeApiError(shifts.error, 'Could not load your shifts.')}
        onRetry={() => shifts.refetch()}
      />
    );
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const showNextMonth = now.getDate() >= NEXT_MONTH_PREVIEW_FROM_DAY;
  const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);

  const sortByStart = (a: Shift, b: Shift) =>
    new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();

  const thisMonth = (shifts.data?.results ?? [])
    .filter(shift => {
      const starts = new Date(shift.starts_at);
      return starts >= monthStart && starts <= monthEnd;
    })
    .sort(sortByStart);

  const nextMonth = showNextMonth
    ? (shifts.data?.results ?? [])
        .filter(shift => {
          const starts = new Date(shift.starts_at);
          return starts > monthEnd && starts <= nextMonthEnd;
        })
        .sort(sortByStart)
    : [];

  const monthLabel = monthStart.toLocaleDateString(undefined, {month: 'long', year: 'numeric'});
  const nextMonthLabel = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString(
    undefined,
    {month: 'long', year: 'numeric'},
  );

  return (
    <Screen onRefresh={() => shifts.refetch()} refreshing={shifts.isRefetching}>
      <Text style={styles.monthHeading}>{monthLabel}</Text>
      {thisMonth.length > 0 ? (
        <Text style={styles.summary}>
          {thisMonth.length} shift{thisMonth.length === 1 ? '' : 's'} -{' '}
          {totalHoursOf(thisMonth).toFixed(1)}h scheduled
        </Text>
      ) : null}

      {thisMonth.length === 0 ? (
        <EmptyState title="No shifts this month" body="Nothing scheduled in this window yet." />
      ) : (
        thisMonth.map((shift, index) => (
          <ShiftCard key={shift.id} shift={shift} delay={index * 40} />
        ))
      )}

      {nextMonth.length > 0 ? (
        <>
          <Text style={styles.monthHeading}>{nextMonthLabel}</Text>
          <Text style={styles.summary}>
            {nextMonth.length} shift{nextMonth.length === 1 ? '' : 's'} -{' '}
            {totalHoursOf(nextMonth).toFixed(1)}h scheduled
          </Text>
          {nextMonth.map((shift, index) => (
            <ShiftCard key={shift.id} shift={shift} delay={index * 40} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthHeading: {fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm},
  summary: {fontSize: 13, color: colors.textMuted, marginTop: -spacing.xs},
  rowHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  day: {fontSize: 15, fontWeight: '700', color: colors.text},
  time: {fontSize: 14, color: colors.textMuted, marginTop: 2},
  notes: {fontSize: 13, color: colors.textMuted, marginTop: spacing.xs},
  offerLink: {fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: spacing.xs},
});
