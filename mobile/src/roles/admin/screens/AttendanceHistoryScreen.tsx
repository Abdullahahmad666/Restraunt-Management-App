import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Badge} from '../../../components/Badge';
import {Card} from '../../../components/Card';
import {Chip, ChipRow} from '../../../components/Chip';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {ScreenHeader} from '../../../components/ScreenHeader';
import {SectionLabel} from '../../../components/SectionLabel';
import {describeApiError} from '../../../api/errors';
import {useAttendanceLogs} from '../../../features/attendance/hooks';
import type {AttendanceStatus} from '../../../features/attendance/types';
import {useStaffAccounts} from '../../../features/staff/hooks';
import {colors, typography} from '../../../theme';
import {formatDateTime, fullName} from '../../../utils/format';
import type {AdminStackParamList} from '../../../navigation/types';

type Route = RouteProp<AdminStackParamList, 'AttendanceHistory'>;
type Nav = NativeStackNavigationProp<AdminStackParamList>;

const STATUS_FILTERS: Array<{label: string; value: AttendanceStatus | undefined}> = [
  {label: 'All', value: undefined},
  {label: 'On shift', value: 'OPEN'},
  {label: 'Closed', value: 'CLOSED'},
];

/** Filterable attendance history, per staff member or across the restaurant. */
export function AttendanceHistoryScreen(): React.JSX.Element {
  const {params} = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const [staffFilter, setStaffFilter] = useState<string | undefined>(params?.staffId);
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | undefined>();

  const staff = useStaffAccounts();
  const logs = useAttendanceLogs({staff: staffFilter, status: statusFilter});

  const nameById = new Map(staff.data?.results.map(member => [member.id, fullName(member)]));

  return (
    <Screen onRefresh={() => logs.refetch()} refreshing={logs.isRefetching}>
      <ScreenHeader
        icon="time"
        title="Attendance"
        subtitle="Past shifts, and any corrections made to them."
      />

      {/*
        Wrapping rows rather than the horizontal scroll strip this replaces.
        A filter that sits off the right edge is one nobody knows exists, and
        a scroll strip gives no hint there is more of it.
      */}
      <SectionLabel label="Who" />
      <ChipRow>
        <Chip label="Everyone" selected={!staffFilter} onPress={() => setStaffFilter(undefined)} />
        {staff.data?.results.map(member => (
          <Chip
            key={member.id}
            label={fullName(member)}
            selected={staffFilter === member.id}
            onPress={() => setStaffFilter(member.id)}
          />
        ))}
      </ChipRow>

      <SectionLabel label="Status" />
      <ChipRow>
        {STATUS_FILTERS.map(filter => (
          <Chip
            key={filter.label}
            label={filter.label}
            selected={statusFilter === filter.value}
            onPress={() => setStatusFilter(filter.value)}
          />
        ))}
      </ChipRow>

      {logs.isLoading ? (
        <LoadingView />
      ) : logs.error ? (
        <ErrorState
          message={describeApiError(logs.error, 'Could not load attendance history.')}
          onRetry={() => logs.refetch()}
        />
      ) : (logs.data?.results.length ?? 0) === 0 ? (
        <EmptyState title="No records" body="Nothing matches these filters yet." />
      ) : (
        logs.data?.results.map(log => (
          <Pressable
            key={log.id}
            onPress={() => navigation.navigate('AttendanceEdit', {logId: log.id})}>
            <Card>
              <View style={styles.rowHeader}>
                <Text style={styles.rowTitle}>{nameById.get(log.staff) ?? 'Staff member'}</Text>
                <Badge
                  label={log.status === 'OPEN' ? 'On shift' : 'Closed'}
                  tone={log.status === 'OPEN' ? 'success' : 'neutral'}
                />
              </View>
              <Text style={styles.rowBody}>In: {formatDateTime(log.clock_in_at)}</Text>
              {log.clock_out_at ? (
                <Text style={styles.rowBody}>Out: {formatDateTime(log.clock_out_at)}</Text>
              ) : null}
              {log.is_manual_override ? (
                <Text style={styles.rowNote}>Manually corrected</Text>
              ) : null}
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  rowTitle: {...typography.body, fontWeight: '600', color: colors.text},
  rowBody: {...typography.caption, fontSize: 14, color: colors.textMuted},
  rowNote: {fontSize: 12, color: colors.warning, fontWeight: '600'},
});
