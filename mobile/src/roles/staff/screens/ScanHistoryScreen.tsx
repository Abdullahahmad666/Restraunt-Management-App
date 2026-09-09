import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {Badge} from '../../../components/Badge';
import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {FadeIn} from '../../../components/FadeIn';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {TextField} from '../../../components/TextField';
import {describeApiError} from '../../../api/errors';
import {useMyLogs, useMyShifts, useUpdateMyLogNote} from '../../../features/attendance/hooks';
import type {AttendanceLog, AttendanceStatus, Shift} from '../../../features/attendance/types';
import {colors, radii, spacing} from '../../../theme';
import {formatDateTime} from '../../../utils/format';

const STATUS_FILTERS: Array<{label: string; value: AttendanceStatus | undefined}> = [
  {label: 'All', value: undefined},
  {label: 'On shift', value: 'OPEN'},
  {label: 'Closed', value: 'CLOSED'},
];

/** How late a check-in was against its matched shift, or null if it wasn't
 * late (early/on-time isn't worth calling out - lateness is). */
function minutesLate(log: AttendanceLog, shiftById: Map<string, Shift>): number | null {
  if (!log.shift) {
    return null;
  }
  const shift = shiftById.get(log.shift);
  if (!shift) {
    return null;
  }
  const lateMs = new Date(log.clock_in_at).getTime() - new Date(shift.starts_at).getTime();
  return lateMs > 60_000 ? Math.round(lateMs / 60_000) : null;
}

/** Every check-in and check-out, filterable, with room to add a note to any
 * of them. */
export function ScanHistoryScreen(): React.JSX.Element {
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | undefined>();
  const shifts = useMyShifts();
  const logs = useMyLogs({status: statusFilter});

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
        message={describeApiError(error, 'Could not load your scan history.')}
        onRetry={refresh}
      />
    );
  }

  const shiftById = new Map((shifts.data?.results ?? []).map(shift => [shift.id, shift]));
  const recentLogs = logs.data?.results ?? [];

  return (
    <Screen onRefresh={refresh} refreshing={shifts.isRefetching || logs.isRefetching}>
      <View style={styles.filterRow}>
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

      {recentLogs.length === 0 ? (
        <EmptyState title="No scans yet" body="Your check-ins and check-outs will show up here." />
      ) : (
        recentLogs.map((log, index) => (
          <FadeIn key={log.id} delay={index * 40}>
            <LogRow log={log} lateMinutes={minutesLate(log, shiftById)} />
          </FadeIn>
        ))
      )}
    </Screen>
  );
}

function LogRow({
  log,
  lateMinutes,
}: {
  log: AttendanceLog;
  lateMinutes: number | null;
}): React.JSX.Element {
  const updateNote = useUpdateMyLogNote();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(log.note);
  const [error, setError] = useState<string | null>(null);

  async function onSaveNote() {
    setError(null);
    try {
      await updateNote.mutateAsync({id: log.id, note});
      setEditing(false);
    } catch (err) {
      setError(describeApiError(err, 'Could not save your note.'));
    }
  }

  return (
    <Card>
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
      {lateMinutes ? (
        <Text style={styles.lateNote}>{lateMinutes} min late against your scheduled start</Text>
      ) : null}
      {log.is_manual_override ? <Text style={styles.rowNote}>Corrected by an admin</Text> : null}

      {editing ? (
        <View style={styles.noteEditor}>
          <TextField
            label="Note"
            placeholder="Car trouble, 10 min late"
            value={note}
            onChangeText={setNote}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.noteActions}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => {
                setNote(log.note);
                setEditing(false);
              }}
            />
            <Button title="Save" onPress={onSaveNote} loading={updateNote.isPending} />
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setEditing(true)} hitSlop={8}>
          <Text style={styles.noteLink}>{log.note ? `Note: ${log.note}` : 'Add a note'}</Text>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  filterRow: {flexDirection: 'row', gap: spacing.xs},
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  chipActive: {backgroundColor: colors.primary, borderColor: colors.primary},
  chipLabel: {fontSize: 13, color: colors.text},
  chipLabelActive: {color: '#FFFFFF', fontWeight: '600'},
  rowHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  rowTitle: {fontSize: 15, fontWeight: '600', color: colors.text},
  rowBody: {fontSize: 14, color: colors.textMuted},
  rowNote: {fontSize: 12, color: colors.warning, fontWeight: '600'},
  lateNote: {fontSize: 12, color: colors.warning, fontWeight: '600'},
  noteLink: {fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: spacing.xs},
  noteEditor: {marginTop: spacing.xs, gap: spacing.xs},
  noteActions: {flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end'},
  error: {color: colors.danger, fontSize: 12},
});
