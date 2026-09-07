import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {Badge} from '../../../components/Badge';
import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {SectionLabel} from '../../../components/SectionLabel';
import {describeApiError} from '../../../api/errors';
import {useMyLogs, useMyShifts} from '../../../features/attendance/hooks';
import {useSignOut} from '../../../features/auth/useSignOut';
import {colors, typography} from '../../../theme';
import {formatDateTime} from '../../../utils/format';

/** This staff member's own upcoming rota and clock-in/out history. */
export function MyAttendanceScreen(): React.JSX.Element {
  const shifts = useMyShifts();
  const logs = useMyLogs();
  const signOut = useSignOut();

  const loading = shifts.isLoading || logs.isLoading;
  const error = shifts.error ?? logs.error;

  function refresh() {
    shifts.refetch();
    logs.refetch();
  }

  if (loading) {
    return <LoadingView />;
  }

  if (error) {
    return (
      <ErrorState
        message={describeApiError(error, 'Could not load your attendance.')}
        onRetry={refresh}
      />
    );
  }

  const upcomingShifts = shifts.data?.results ?? [];
  const recentLogs = logs.data?.results ?? [];

  return (
    <Screen onRefresh={refresh} refreshing={shifts.isRefetching || logs.isRefetching}>
      <SectionLabel label="Upcoming shifts" />
      {upcomingShifts.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No shifts scheduled"
          body="Check back once the rota is published."
        />
      ) : (
        upcomingShifts.map(shift => (
          <Card key={shift.id}>
            <Text style={styles.rowTitle}>
              {formatDateTime(shift.starts_at)} - {formatDateTime(shift.ends_at)}
            </Text>
            {shift.notes ? <Text style={styles.rowBody}>{shift.notes}</Text> : null}
          </Card>
        ))
      )}

      <SectionLabel label="Recent scans" />
      {recentLogs.length === 0 ? (
        <EmptyState
          icon="scan"
          title="No scans yet"
          body="Your check-ins and check-outs will show up here."
        />
      ) : (
        recentLogs.map(log => (
          <Card key={log.id}>
            <View style={styles.rowHeader}>
              <Text style={styles.rowTitle}>{formatDateTime(log.clock_in_at)}</Text>
              <Badge
                label={log.status === 'OPEN' ? 'On shift' : 'Closed'}
                tone={log.status === 'OPEN' ? 'success' : 'neutral'}
              />
            </View>
            {log.clock_out_at ? (
              <Text style={styles.rowBody}>Out: {formatDateTime(log.clock_out_at)}</Text>
            ) : null}
            {log.is_manual_override ? (
              <Text style={styles.rowNote}>Corrected by an admin</Text>
            ) : null}
          </Card>
        ))
      )}

      <Button title="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  rowTitle: {...typography.body, fontWeight: '600', color: colors.text},
  rowBody: {...typography.caption, fontSize: 14, color: colors.textMuted},
  rowNote: {fontSize: 12, color: colors.warning, fontWeight: '600'},
});
