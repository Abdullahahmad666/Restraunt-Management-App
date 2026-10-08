import React, {useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Badge} from '../../../components/Badge';
import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {FilterChip} from '../../../components/FilterChip';
import {LoadingView} from '../../../components/LoadingView';
import {PressableScale} from '../../../components/PressableScale';
import {Screen} from '../../../components/Screen';
import {SegmentedToggle} from '../../../components/SegmentedToggle';
import {describeApiError} from '../../../api/errors';
import {useAttendanceLogs} from '../../../features/attendance/hooks';
import {ATTENDANCE_STATUS_FILTERS, statusQuery} from '../../../features/attendance/types';
import type {AttendanceStatusFilter} from '../../../features/attendance/types';
import {useStaffAccounts} from '../../../features/staff/hooks';
import {colors, spacing} from '../../../theme';
import {formatDateTime, fullName} from '../../../utils/format';
import type {AdminStackParamList} from '../../../navigation/types';

type Route = RouteProp<AdminStackParamList, 'AttendanceHistory'>;
type Nav = NativeStackNavigationProp<AdminStackParamList>;

/** Filterable attendance history, per staff member or across the restaurant. */
export function AttendanceHistoryScreen(): React.JSX.Element {
  const {params} = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const [staffFilter, setStaffFilter] = useState<string | undefined>(params?.staffId);
  const [statusFilter, setStatusFilter] = useState<AttendanceStatusFilter>('ALL');

  const staff = useStaffAccounts();
  const logs = useAttendanceLogs({staff: staffFilter, status: statusQuery(statusFilter)});

  const nameById = new Map(staff.data?.results.map(member => [member.id, fullName(member)]));

  return (
    <Screen onRefresh={() => logs.refetch()} refreshing={logs.isRefetching}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.staffRow}>
        <FilterChip
          label="Everyone"
          selected={!staffFilter}
          onPress={() => setStaffFilter(undefined)}
        />
        {staff.data?.results.map(member => (
          <FilterChip
            key={member.id}
            label={fullName(member)}
            selected={staffFilter === member.id}
            onPress={() => setStaffFilter(member.id)}
          />
        ))}
      </ScrollView>

      <SegmentedToggle
        options={ATTENDANCE_STATUS_FILTERS}
        value={statusFilter}
        onChange={setStatusFilter}
        accessibilityLabel="Which check-ins to show"
        compact
      />

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
          <PressableScale
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
          </PressableScale>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  staffRow: {flexDirection: 'row', gap: spacing.xs},
  rowHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  rowTitle: {fontSize: 15, fontWeight: '600', color: colors.text},
  rowBody: {fontSize: 14, color: colors.textMuted},
  rowNote: {fontSize: 12, color: colors.warning, fontWeight: '600'},
});
