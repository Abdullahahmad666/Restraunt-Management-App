import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Badge} from '../../../components/Badge';
import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {describeApiError} from '../../../api/errors';
import {useAttendanceLogs} from '../../../features/attendance/hooks';
import type {AttendanceStatus} from '../../../features/attendance/types';
import {useStaffAccounts} from '../../../features/staff/hooks';
import {colors, radii, spacing} from '../../../theme';
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        <Pressable
          onPress={() => setStaffFilter(undefined)}
          style={[styles.chip, !staffFilter && styles.chipActive]}>
          <Text style={[styles.chipLabel, !staffFilter && styles.chipLabelActive]}>Everyone</Text>
        </Pressable>
        {staff.data?.results.map(member => (
          <Pressable
            key={member.id}
            onPress={() => setStaffFilter(member.id)}
            style={[styles.chip, staffFilter === member.id && styles.chipActive]}>
            <Text style={[styles.chipLabel, staffFilter === member.id && styles.chipLabelActive]}>
              {fullName(member)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.chipRow}>
        {STATUS_FILTERS.map(filter => (
          <Pressable
            key={filter.label}
            onPress={() => setStatusFilter(filter.value)}
            style={[styles.chip, statusFilter === filter.value && styles.chipActive]}>
            <Text
              style={[styles.chipLabel, statusFilter === filter.value && styles.chipLabelActive]}>
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </View>

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
  chipRow: {flexDirection: 'row', gap: spacing.xs},
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.xs,
  },
  chipActive: {backgroundColor: colors.primary, borderColor: colors.primary},
  chipLabel: {fontSize: 13, color: colors.text},
  chipLabelActive: {color: '#FFFFFF', fontWeight: '600'},
  rowHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  rowTitle: {fontSize: 15, fontWeight: '600', color: colors.text},
  rowBody: {fontSize: 14, color: colors.textMuted},
  rowNote: {fontSize: 12, color: colors.warning, fontWeight: '600'},
});
