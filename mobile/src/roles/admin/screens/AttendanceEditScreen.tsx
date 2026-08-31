import React, {useState} from 'react';
import {StyleSheet, Text} from 'react-native';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Button} from '../../../components/Button';
import {ErrorState} from '../../../components/ErrorState';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {TextField} from '../../../components/TextField';
import {describeApiError} from '../../../api/errors';
import {useAttendanceLog, useCreateShift, useUpdateLog} from '../../../features/attendance/hooks';
import {colors} from '../../../theme';
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

function AddShift({staffId, onDone}: {staffId: string; onDone: () => void}): React.JSX.Element {
  const createShift = useCreateShift();
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setError(null);
    if (!startsAt || !endsAt) {
      setError('Both a start and end time are required.');
      return;
    }
    try {
      await createShift.mutateAsync({
        staff: staffId,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        notes,
      });
      onDone();
    } catch (err) {
      setError(describeApiError(err, 'Could not add this shift.'));
    }
  }

  return (
    <Screen scroll>
      <Text style={styles.heading}>Add a shift</Text>

      <TextField
        label="Starts at"
        placeholder="2026-08-28 09:00"
        value={startsAt}
        onChangeText={setStartsAt}
      />
      <TextField
        label="Ends at"
        placeholder="2026-08-28 17:00"
        value={endsAt}
        onChangeText={setEndsAt}
      />
      <TextField
        label="Notes (optional)"
        placeholder="Cover for Sara"
        value={notes}
        onChangeText={setNotes}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Add shift" onPress={onSave} loading={createShift.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 22, fontWeight: '700', color: colors.text},
  hint: {fontSize: 13, color: colors.textMuted},
  error: {color: colors.danger},
});
