import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Badge} from '../../../components/Badge';
import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {FadeIn} from '../../../components/FadeIn';
import {GridTile} from '../../../components/GridTile';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {describeApiError} from '../../../api/errors';
import {useMyShifts} from '../../../features/attendance/hooks';
import {JOB_TITLE_LABELS} from '../../../features/attendance/types';
import {colors, spacing} from '../../../theme';
import {formatDateTime} from '../../../utils/format';
import type {StaffStackParamList} from '../../../navigation/types';

type Nav = NativeStackNavigationProp<StaffStackParamList>;

/** The staff landing page: what's next, then a grid into everything else -
 * shifts, pay, scan history, notifications - each on its own screen instead
 * of one long page trying to be all of them at once. */
export function MyAttendanceScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
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

  const now = Date.now();
  const nextShift = (shifts.data?.results ?? [])
    .filter(shift => new Date(shift.starts_at).getTime() >= now)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];

  return (
    <Screen onRefresh={() => shifts.refetch()} refreshing={shifts.isRefetching}>
      <Text style={styles.heading}>My hours</Text>

      <FadeIn>
        {nextShift ? (
          <Card style={styles.nextShiftCard}>
            <Text style={styles.nextShiftLabel}>Next shift</Text>
            <Text style={styles.nextShiftTime}>
              {formatDateTime(nextShift.starts_at)} - {formatDateTime(nextShift.ends_at)}
            </Text>
            {nextShift.job_title ? (
              <Badge label={JOB_TITLE_LABELS[nextShift.job_title]} tone="neutral" />
            ) : null}
          </Card>
        ) : (
          <EmptyState title="No shifts scheduled" body="Check back once the rota is published." />
        )}
      </FadeIn>

      <View style={styles.grid}>
        <FadeIn delay={60} style={styles.tileWrap}>
          <GridTile
            icon="calendar-outline"
            label="My shifts"
            subtitle="This month's rota"
            onPress={() => navigation.navigate('MyShifts')}
          />
        </FadeIn>
        <FadeIn delay={110} style={styles.tileWrap}>
          <GridTile
            icon="cash-outline"
            label="My pay"
            subtitle="Rates & earnings"
            onPress={() => navigation.navigate('MyPay')}
          />
        </FadeIn>
        <FadeIn delay={160} style={styles.tileWrap}>
          <GridTile
            icon="time-outline"
            label="Scan history"
            subtitle="Check-ins & outs"
            onPress={() => navigation.navigate('ScanHistory')}
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
            subtitle="Cover & offer shifts"
            onPress={() => navigation.navigate('SwapRequests')}
          />
        </FadeIn>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 22, fontWeight: '700', color: colors.text},
  nextShiftCard: {borderColor: colors.primary, borderWidth: 1},
  nextShiftLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  nextShiftTime: {fontSize: 15, fontWeight: '600', color: colors.text},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between'},
  tileWrap: {width: '48%'},
});
