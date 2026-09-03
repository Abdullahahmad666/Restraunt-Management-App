import React, {useMemo, useState} from 'react';
import {Platform, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';

import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
import {ErrorState} from '../../../components/ErrorState';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {TextField} from '../../../components/TextField';
import {describeApiError} from '../../../api/errors';
import {
  useAttendanceLog,
  useCreateShift,
  useDeleteShift,
  useShifts,
  useUpdateLog,
} from '../../../features/attendance/hooks';
import {JOB_TITLE_LABELS, type JobTitle} from '../../../features/attendance/types';
import {colors, spacing} from '../../../theme';
import {formatTime} from '../../../utils/format';
import type {AdminStackParamList} from '../../../navigation/types';

type Route = RouteProp<AdminStackParamList, 'AttendanceEdit'>;
type Nav = NativeStackNavigationProp<AdminStackParamList>;

/** Correct an existing clock-in/out record, or add a rota shift by hand. */
export function AttendanceEditScreen(): React.JSX.Element {
  const {params} = useRoute<Route>();
  const navigation = useNavigation<Nav>();

  return params.logId ? (
    <EditLog logId={params.logId} onDone={() => navigation.goBack()} />
  ) : params.staffId ? (
    <AddShift staffId={params.staffId} onDone={() => navigation.goBack()} />
  ) : (
    <ErrorState message="No staff member or record was selected to edit." />
  );
}

function EditLog({logId, onDone}: {logId: string; onDone: () => void}): React.JSX.Element {
  const logQuery = useAttendanceLog(logId);
  const updateLog = useUpdateLog();
  const log = logQuery.data;

  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (logQuery.isLoading) {
    return <LoadingView />;
  }
  if (!log) {
    return <ErrorState message="That attendance record could not be found." />;
  }

  async function onSave() {
    setError(null);
    try {
      await updateLog.mutateAsync({
        id: logId,
        correction: {
          clock_in_at: clockIn ? new Date(clockIn).toISOString() : undefined,
          clock_out_at: clockOut ? new Date(clockOut).toISOString() : undefined,
        },
      });
      onDone();
    } catch (err) {
      setError(describeApiError(err, 'Could not save this correction.'));
    }
  }

  return (
    <Screen scroll>
      <Text style={styles.heading}>Correct record</Text>
      <Text style={styles.hint}>Currently: {new Date(log.clock_in_at).toLocaleString()}</Text>

      <TextField
        label="New check-in (leave blank to keep)"
        placeholder="2026-08-27 09:00"
        value={clockIn}
        onChangeText={setClockIn}
      />
      <TextField
        label="New check-out (leave blank to keep)"
        placeholder="2026-08-27 17:00"
        value={clockOut}
        onChangeText={setClockOut}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Save correction" onPress={onSave} loading={updateLog.isPending} />
    </Screen>
  );
}

/** Today plus the next `count - 1` days, as local calendar dates. */
function upcomingDays(count: number): {iso: string; weekday: string; dayNum: string}[] {
  const out = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    out.push({
      iso: toLocalIsoDate(date),
      weekday: date.toLocaleDateString(undefined, {weekday: 'short'}),
      dayNum: String(date.getDate()),
    });
  }
  return out;
}

/** getters, not toISOString().slice(0, 10) - that converts to UTC first,
 * which shifts the calendar date by one for anyone west of UTC. */
function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** A local calendar date plus a time-of-day, as one Date - both are read in
 * local time, so the .toISOString() sent to the server lands on the clock
 * time the manager actually picked, not shifted by their timezone. */
function combineDateAndTime(isoDate: string, time: Date): Date {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  const day = Number(isoDate.slice(8, 10));
  return new Date(year, month - 1, day, time.getHours(), time.getMinutes(), 0, 0);
}

function formatTimeOfDay(date: Date): string {
  return date.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'});
}

const JOB_TITLES = Object.keys(JOB_TITLE_LABELS) as JobTitle[];

function AddShift({staffId, onDone}: {staffId: string; onDone: () => void}): React.JSX.Element {
  const createShift = useCreateShift();
  const deleteShift = useDeleteShift();
  const upcomingShifts = useShifts({staff: staffId});
  const days = useMemo(() => upcomingDays(7), []);

  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [startTime, setStartTime] = useState(() => new Date(2000, 0, 1, 9, 0));
  const [endTime, setEndTime] = useState(() => new Date(2000, 0, 1, 17, 0));
  const [jobTitle, setJobTitle] = useState<JobTitle | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleDay(iso: string) {
    setSelectedDays(current => {
      const next = new Set(current);
      if (next.has(iso)) {
        next.delete(iso);
      } else {
        next.add(iso);
      }
      return next;
    });
  }

  async function onSave() {
    setError(null);
    if (selectedDays.size === 0) {
      setError('Select at least one day.');
      return;
    }
    setSubmitting(true);
    try {
      // One request per day - there is no bulk-create endpoint, and the
      // count is small (at most 7, the days on offer above).
      for (const iso of selectedDays) {
        const starts = combineDateAndTime(iso, startTime);
        let ends = combineDateAndTime(iso, endTime);
        if (ends <= starts) {
          // An end time not after the start means it rolls past midnight -
          // an overnight closing shift, not an invalid one.
          ends = new Date(ends.getTime() + 24 * 60 * 60 * 1000);
        }
        await createShift.mutateAsync({
          staff: staffId,
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          job_title: jobTitle ?? '',
          notes,
        });
      }
      onDone();
    } catch (err) {
      setError(describeApiError(err, 'Could not add these shifts.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll>
      <Text style={styles.heading}>Add shifts</Text>
      <Text style={styles.hint}>
        Pick the day or days this person is working, then set one start and end time to apply to all
        of them.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayRow}>
        {days.map(day => {
          const selected = selectedDays.has(day.iso);
          return (
            <Pressable
              key={day.iso}
              onPress={() => toggleDay(day.iso)}
              style={[styles.dayChip, selected && styles.chipSelected]}>
              <Text style={[styles.dayChipWeekday, selected && styles.chipTextSelected]}>
                {day.weekday}
              </Text>
              <Text style={[styles.dayChipNum, selected && styles.chipTextSelected]}>
                {day.dayNum}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.timeRow}>
        <TimePickerField label="Start time" value={startTime} onChange={setStartTime} />
        <TimePickerField label="End time" value={endTime} onChange={setEndTime} />
      </View>

      <Text style={styles.label}>Job title (optional)</Text>
      <View style={styles.chipRow}>
        {JOB_TITLES.map(title => {
          const selected = jobTitle === title;
          return (
            <Pressable
              key={title}
              onPress={() => setJobTitle(current => (current === title ? null : title))}
              style={[styles.chip, selected && styles.chipSelected]}>
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {JOB_TITLE_LABELS[title]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextField
        label="Notes (optional)"
        placeholder="Cover for Sara"
        value={notes}
        onChangeText={setNotes}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title={selectedDays.size > 1 ? `Add ${selectedDays.size} shifts` : 'Add shift'}
        onPress={onSave}
        loading={submitting}
        disabled={selectedDays.size === 0}
      />

      {upcomingShifts.data && upcomingShifts.data.results.length > 0 ? (
        <View style={styles.existing}>
          <Text style={styles.label}>Upcoming shifts</Text>
          {upcomingShifts.data.results.map(shift => (
            <Card key={shift.id} style={styles.shiftRow}>
              <View>
                <Text style={styles.rowTitle}>
                  {new Date(shift.starts_at).toLocaleDateString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
                <Text style={styles.rowBody}>
                  {formatTime(shift.starts_at)} - {formatTime(shift.ends_at)}
                  {shift.job_title ? ` · ${JOB_TITLE_LABELS[shift.job_title]}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => deleteShift.mutate(shift.id)} hitSlop={8}>
                <Text style={styles.removeLink}>Remove</Text>
              </Pressable>
            </Card>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function TimePickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.timeField}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.timeButton} onPress={() => setOpen(true)} accessibilityRole="button">
        <Text style={styles.timeButtonText}>{formatTimeOfDay(value)}</Text>
      </Pressable>

      {open ? (
        <DateTimePicker
          value={value}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            if (Platform.OS === 'android') {
              setOpen(false);
            }
            if (event.type !== 'dismissed' && date) {
              onChange(date);
            }
          }}
        />
      ) : null}
      {open && Platform.OS === 'ios' ? (
        <Button title="Done" variant="secondary" onPress={() => setOpen(false)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 22, fontWeight: '700', color: colors.text},
  hint: {fontSize: 13, color: colors.textMuted},
  label: {fontSize: 13, fontWeight: '600', color: colors.textMuted},
  error: {color: colors.danger},

  dayRow: {flexDirection: 'row', gap: spacing.sm},
  dayChip: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 52,
  },
  dayChipWeekday: {fontSize: 12, color: colors.textMuted},
  dayChipNum: {fontSize: 16, fontWeight: '700', color: colors.text},

  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipText: {fontSize: 14, color: colors.text},
  chipSelected: {backgroundColor: colors.primary, borderColor: colors.primary},
  chipTextSelected: {color: '#FFFFFF', fontWeight: '700'},

  timeRow: {flexDirection: 'row', gap: spacing.md},
  timeField: {flex: 1, gap: spacing.xs},
  timeButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
  },
  timeButtonText: {fontSize: 16, color: colors.text, fontWeight: '600'},

  existing: {gap: spacing.sm},
  shiftRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  rowTitle: {fontSize: 16, fontWeight: '600', color: colors.text},
  rowBody: {fontSize: 13, color: colors.textMuted},
  removeLink: {fontSize: 13, color: colors.danger, fontWeight: '600'},
});
