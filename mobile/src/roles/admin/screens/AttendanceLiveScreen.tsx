import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Badge} from '../../../components/Badge';
import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {describeApiError} from '../../../api/errors';
import {useLiveLogs, useShifts} from '../../../features/attendance/hooks';
import {useStaffAccounts} from '../../../features/staff/hooks';
import {colors} from '../../../theme';
import {formatElapsed, formatTime, fullName} from '../../../utils/format';
import type {AdminStackParamList} from '../../../navigation/types';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

/** Who is currently checked in, right now. Refreshes itself every 30s. */
export function AttendanceLiveScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const live = useLiveLogs();
  const staff = useStaffAccounts();
  // Every rota shift for the restaurant, so each live log can show its
  // scheduled start/end - a scan auto-matches to a nearby shift server-side
  // (see apps.attendance.services.scan), but the live log itself only
  // carries that shift's id, not its times.
  const shifts = useShifts();

  if (live.isLoading || staff.isLoading) {
    return <LoadingView />;
  }

  if (live.error) {
    return (
      <ErrorState
        message={describeApiError(live.error, 'Could not load who is on shift.')}
        onRetry={() => live.refetch()}
      />
    );
  }

  const nameById = new Map(staff.data?.results.map(member => [member.id, fullName(member)]));
  const shiftById = new Map(shifts.data?.results.map(shift => [shift.id, shift]));
  const logs = live.data ?? [];

  return (
    <Screen onRefresh={() => live.refetch()} refreshing={live.isRefetching}>
      {logs.length === 0 ? (
        <EmptyState
          title="Nobody is checked in"
          body="Staff on shift will show up here as soon as they scan in."
        />
      ) : (
        logs.map(log => {
          const shift = log.shift ? shiftById.get(log.shift) : undefined;
          return (
            <Pressable
              key={log.id}
              onPress={() => navigation.navigate('AttendanceHistory', {staffId: log.staff})}>
              <Card>
                <Text style={styles.name}>{nameById.get(log.staff) ?? 'Staff member'}</Text>
                <Text style={styles.detail}>
                  {shift
                    ? `Shift: ${formatTime(shift.starts_at)} - ${formatTime(shift.ends_at)}`
                    : `Checked in ${formatTime(log.clock_in_at)}`}
                </Text>
                <Badge label={`On shift ${formatElapsed(log.clock_in_at)}`} tone="success" />
              </Card>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: {fontSize: 16, fontWeight: '600', color: colors.text},
  detail: {fontSize: 13, color: colors.textMuted},
});
