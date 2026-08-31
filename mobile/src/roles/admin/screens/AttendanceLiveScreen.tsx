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
import {useLiveLogs} from '../../../features/attendance/hooks';
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
  const logs = live.data ?? [];

  return (
    <Screen onRefresh={() => live.refetch()} refreshing={live.isRefetching}>
      {logs.length === 0 ? (
        <EmptyState
          title="Nobody is checked in"
          body="Staff on shift will show up here as soon as they scan in."
        />
      ) : (
        logs.map(log => (
          <Pressable
            key={log.id}
            onPress={() => navigation.navigate('AttendanceHistory', {staffId: log.staff})}>
            <Card>
              <Text style={styles.name}>{nameById.get(log.staff) ?? 'Staff member'}</Text>
              <Text style={styles.detail}>Checked in {formatTime(log.clock_in_at)}</Text>
              <Badge label={`On shift ${formatElapsed(log.clock_in_at)}`} tone="success" />
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: {fontSize: 16, fontWeight: '600', color: colors.text},
  detail: {fontSize: 13, color: colors.textMuted},
});
