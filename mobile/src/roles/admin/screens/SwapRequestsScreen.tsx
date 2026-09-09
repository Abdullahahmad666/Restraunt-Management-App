import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

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
import {
  useApproveShiftSwapRequest,
  useDeclineShiftSwapRequest,
  useShiftSwapRequests,
} from '../../../features/attendance/hooks';
import {JOB_TITLE_LABELS} from '../../../features/attendance/types';
import type {ShiftSwapRequest, ShiftSwapStatus} from '../../../features/attendance/types';
import {colors, spacing} from '../../../theme';
import {formatTime} from '../../../utils/format';

const STATUS_TONE: Record<ShiftSwapStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  DECLINED: 'danger',
  CANCELLED: 'neutral',
};

function shiftWindow(swap: ShiftSwapRequest): string {
  const day = new Date(swap.shift_starts_at).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return `${day}, ${formatTime(swap.shift_starts_at)} - ${formatTime(swap.shift_ends_at)}`;
}

function PendingSwapCard({
  swap,
  delay,
}: {
  swap: ShiftSwapRequest;
  delay: number;
}): React.JSX.Element {
  const approve = useApproveShiftSwapRequest();
  const decline = useDeclineShiftSwapRequest();
  const [declining, setDeclining] = useState(false);
  const [declineNote, setDeclineNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onApprove() {
    setError(null);
    try {
      await approve.mutateAsync(swap.id);
    } catch (err) {
      setError(describeApiError(err, 'Could not approve this swap.'));
    }
  }

  async function onConfirmDecline() {
    setError(null);
    try {
      await decline.mutateAsync({id: swap.id, decisionNote: declineNote});
    } catch (err) {
      setError(describeApiError(err, 'Could not decline this swap.'));
    }
  }

  return (
    <FadeIn delay={delay}>
      <Card>
        <Text style={styles.rowTitle}>{shiftWindow(swap)}</Text>
        {swap.shift_job_title ? (
          <Text style={styles.rowBody}>{JOB_TITLE_LABELS[swap.shift_job_title]}</Text>
        ) : null}
        <Text style={styles.rowBody}>
          {swap.requested_by_name} wants {swap.target_staff_name} to cover this shift.
        </Text>
        {swap.note ? <Text style={styles.note}>"{swap.note}"</Text> : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {declining ? (
          <View style={styles.declineForm}>
            <TextField
              label="Reason (optional)"
              placeholder="Let them know why"
              value={declineNote}
              onChangeText={setDeclineNote}
            />
            <View style={styles.formActions}>
              <Button title="Back" variant="secondary" onPress={() => setDeclining(false)} />
              <Button
                title="Confirm decline"
                onPress={onConfirmDecline}
                loading={decline.isPending}
              />
            </View>
          </View>
        ) : (
          <View style={styles.formActions}>
            <Button title="Decline" variant="secondary" onPress={() => setDeclining(true)} />
            <Button title="Approve" onPress={onApprove} loading={approve.isPending} />
          </View>
        )}
      </Card>
    </FadeIn>
  );
}

function DecidedSwapRow({swap, delay}: {swap: ShiftSwapRequest; delay: number}): React.JSX.Element {
  return (
    <FadeIn delay={delay}>
      <Card>
        <View style={styles.rowHeader}>
          <Text style={styles.rowTitle}>{shiftWindow(swap)}</Text>
          <Badge label={swap.status} tone={STATUS_TONE[swap.status]} />
        </View>
        <Text style={styles.rowBody}>
          {swap.requested_by_name} to {swap.target_staff_name}
        </Text>
        {swap.decision_note ? <Text style={styles.note}>"{swap.decision_note}"</Text> : null}
      </Card>
    </FadeIn>
  );
}

/** Every swap request a staff member has raised, and the approve/decline
 * call on each - see apps.attendance.services.swap on the backend. Approving
 * reassigns the shift there and then; there's no separate "apply" step. */
export function SwapRequestsScreen(): React.JSX.Element {
  const swaps = useShiftSwapRequests();

  if (swaps.isLoading) {
    return <LoadingView />;
  }
  if (swaps.error) {
    return (
      <ErrorState
        message={describeApiError(swaps.error, 'Could not load swap requests.')}
        onRetry={() => swaps.refetch()}
      />
    );
  }

  const all = swaps.data?.results ?? [];
  const pending = all.filter(swap => swap.status === 'PENDING');
  const decided = all.filter(swap => swap.status !== 'PENDING');

  return (
    <Screen onRefresh={() => swaps.refetch()} refreshing={swaps.isRefetching}>
      <Text style={styles.heading}>Pending</Text>
      {pending.length === 0 ? (
        <EmptyState title="Nothing to review" body="No swap requests are waiting on you." />
      ) : (
        pending.map((swap, index) => (
          <PendingSwapCard key={swap.id} swap={swap} delay={index * 50} />
        ))
      )}

      <Text style={styles.heading}>Past decisions</Text>
      {decided.length === 0 ? (
        <EmptyState title="Nothing here yet" body="Decided requests will show up here." />
      ) : (
        decided.map((swap, index) => (
          <DecidedSwapRow key={swap.id} swap={swap} delay={index * 40} />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.sm},
  rowHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  rowTitle: {fontSize: 14, fontWeight: '700', color: colors.text, flex: 1, marginRight: spacing.sm},
  rowBody: {fontSize: 13, color: colors.textMuted},
  note: {fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.xs},
  error: {color: colors.danger, fontSize: 12},
  formActions: {flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm},
  declineForm: {gap: spacing.sm, marginTop: spacing.xs},
});
