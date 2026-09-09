import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';

import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {TextField} from '../../../components/TextField';
import {describeApiError} from '../../../api/errors';
import {
  useColleagues,
  useCreateShiftSwapRequest,
  useMyShifts,
} from '../../../features/attendance/hooks';
import {JOB_TITLE_LABELS} from '../../../features/attendance/types';
import type {Shift} from '../../../features/attendance/types';
import type {StaffStackParamList} from '../../../navigation/types';
import {colors, radii, spacing} from '../../../theme';
import {formatTime, fullName} from '../../../utils/format';

type Nav = NativeStackNavigationProp<StaffStackParamList>;
type Route = RouteProp<StaffStackParamList, 'RequestSwap'>;

/**
 * Offer one of your own upcoming shifts to a colleague. This is a hand-off,
 * not a trade - the colleague just takes over the shift, subject to your
 * manager's approval (see AdminShiftSwapRequestViewSet.approve on the
 * backend). Nothing changes until a manager says yes.
 *
 * Reached two ways: with a shift already picked (tapping "Offer this shift"
 * on a shift card), or with none (tapping "Request a swap" from Swap
 * requests) - in which case step one is picking which upcoming shift to
 * offer, right here, rather than sending someone back to My shifts first.
 */
export function RequestSwapScreen(): React.JSX.Element {
  const route = useRoute<Route>();
  const [shift, setShift] = useState<Shift | null>(route.params?.shift ?? null);

  return shift ? (
    <OfferForm shift={shift} onChangeShift={() => setShift(null)} />
  ) : (
    <ShiftPicker onPick={setShift} />
  );
}

/** Step one, only shown when no shift arrived via route params: pick which
 * upcoming shift to offer. */
function ShiftPicker({onPick}: {onPick: (shift: Shift) => void}): React.JSX.Element {
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
  const upcoming = (shifts.data?.results ?? [])
    .filter(shift => new Date(shift.starts_at).getTime() > now)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  return (
    <Screen>
      <Text style={styles.sectionTitle}>Which shift do you want to offer?</Text>
      {upcoming.length === 0 ? (
        <EmptyState
          title="No upcoming shifts"
          body="Once you've got a shift on the rota, it'll show up here to offer."
        />
      ) : (
        upcoming.map(shift => (
          <Pressable key={shift.id} onPress={() => onPick(shift)}>
            <Card style={styles.pickCard}>
              <View>
                <Text style={styles.shiftDate}>
                  {new Date(shift.starts_at).toLocaleDateString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
                <Text style={styles.shiftTime}>
                  {formatTime(shift.starts_at)} - {formatTime(shift.ends_at)}
                </Text>
              </View>
              <Text style={styles.pickLink}>Offer &gt;</Text>
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

/** Step two: pick who covers it, and send the request. */
function OfferForm({
  shift,
  onChangeShift,
}: {
  shift: Shift;
  onChangeShift: () => void;
}): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const colleagues = useColleagues();
  const createSwap = useCreateShiftSwapRequest();

  const [targetId, setTargetId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!targetId) {
      setError('Pick who you want to cover this shift.');
      return;
    }
    setError(null);
    try {
      await createSwap.mutateAsync({shift: shift.id, target_staff: targetId, note});
      navigation.navigate('SwapRequests');
    } catch (err) {
      setError(describeApiError(err, 'Could not send that swap request.'));
    }
  }

  return (
    <Screen>
      <Card>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Shift to offer</Text>
          <Pressable onPress={onChangeShift}>
            <Text style={styles.changeLink}>Change</Text>
          </Pressable>
        </View>
        <Text style={styles.shiftDate}>
          {new Date(shift.starts_at).toLocaleDateString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
          })}
        </Text>
        <Text style={styles.shiftTime}>
          {formatTime(shift.starts_at)} - {formatTime(shift.ends_at)}
          {shift.job_title ? ` - ${JOB_TITLE_LABELS[shift.job_title]}` : ''}
        </Text>
      </Card>

      <Text style={styles.sectionTitle}>Who should cover it?</Text>
      {colleagues.isLoading ? (
        <LoadingView />
      ) : colleagues.error ? (
        <ErrorState
          message={describeApiError(colleagues.error, 'Could not load your colleagues.')}
          onRetry={() => colleagues.refetch()}
        />
      ) : colleagues.data?.results.length === 0 ? (
        <EmptyState
          title="No other staff yet"
          body="There's nobody else on the team to offer this shift to."
        />
      ) : (
        <View style={styles.chipRow}>
          {colleagues.data?.results.map(colleague => {
            const selected = targetId === colleague.id;
            return (
              <Pressable
                key={colleague.id}
                onPress={() => setTargetId(colleague.id)}
                style={[styles.chip, selected && styles.chipSelected]}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {fullName(colleague)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <TextField
        label="Reason (optional)"
        placeholder="e.g. Doctor's appointment"
        value={note}
        onChangeText={setNote}
        multiline
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Send swap request" onPress={onSubmit} loading={createSwap.isPending} />
      <Text style={styles.hint}>
        Your manager still has to approve this before the shift actually changes hands.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  cardTitle: {fontSize: 14, fontWeight: '700', color: colors.text},
  changeLink: {fontSize: 12, color: colors.primary, fontWeight: '600'},
  shiftDate: {fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.xs},
  shiftTime: {fontSize: 14, color: colors.textMuted},
  sectionTitle: {fontSize: 14, fontWeight: '700', color: colors.text, marginTop: spacing.sm},
  pickCard: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  pickLink: {fontSize: 13, color: colors.primary, fontWeight: '700'},
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipSelected: {backgroundColor: colors.primary, borderColor: colors.primary},
  chipText: {fontSize: 13, color: colors.text},
  chipTextSelected: {color: '#FFFFFF', fontWeight: '700'},
  hint: {fontSize: 12, color: colors.textMuted, textAlign: 'center'},
  error: {color: colors.danger, fontSize: 13},
});
