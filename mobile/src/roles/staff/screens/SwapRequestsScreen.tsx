import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Badge} from '../../../components/Badge';
import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {FadeIn} from '../../../components/FadeIn';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {describeApiError} from '../../../api/errors';
import {
  useCancelShiftSwapRequest,
  useMyShiftSwapRequests,
} from '../../../features/attendance/hooks';
import {JOB_TITLE_LABELS} from '../../../features/attendance/types';
import type {ShiftSwapRequest, ShiftSwapStatus} from '../../../features/attendance/types';
import type {StaffStackParamList} from '../../../navigation/types';
import {useAuthStore} from '../../../store/authStore';
import {colors, spacing} from '../../../theme';
import {formatTime} from '../../../utils/format';

type Nav = NativeStackNavigationProp<StaffStackParamList>;

const STATUS_TONE: Record<ShiftSwapStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'neutral',
  APPROVED: 'success',
  DECLINED: 'danger',
  CANCELLED: 'neutral',
};

function SwapRow({
  swap,
  showCancel,
}: {
  swap: ShiftSwapRequest;
  showCancel: boolean;
}): React.JSX.Element {
  const cancel = useCancelShiftSwapRequest();
  const [error, setError] = useState<string | null>(null);

  async function onCancel() {
    setError(null);
    try {
      await cancel.mutateAsync(swap.id);
    } catch (err) {
      setError(describeApiError(err, 'Could not cancel this request.'));
    }
  }

  return (
    <Card>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle}>
          {new Date(swap.shift_starts_at).toLocaleDateString(undefined, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })}{' '}
          - {formatTime(swap.shift_starts_at)}-{formatTime(swap.shift_ends_at)}
        </Text>
        <Badge label={swap.status} tone={STATUS_TONE[swap.status]} />
      </View>
      {swap.shift_job_title ? (
        <Text style={styles.rowBody}>{JOB_TITLE_LABELS[swap.shift_job_title]}</Text>
      ) : null}
      <Text style={styles.rowBody}>
        {showCancel ? `Offered to ${swap.target_staff_name}` : `From ${swap.requested_by_name}`}
      </Text>
      {swap.note ? <Text style={styles.note}>"{swap.note}"</Text> : null}
      {swap.status === 'DECLINED' && swap.decision_note ? (
        <Text style={styles.note}>Manager: "{swap.decision_note}"</Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {showCancel && swap.status === 'PENDING' ? (
        <Button
          title="Cancel request"
          variant="secondary"
          onPress={onCancel}
          loading={cancel.isPending}
        />
      ) : null}
    </Card>
  );
}

/**
 * Every shift-swap request that touches you - the ones you've sent, asking
 * a colleague to cover for you, and the ones a colleague has sent you.
 * There's no "accept" here on purpose: a manager makes the actual call (see
 * RequestSwapScreen) - this is where you track what's pending, not where
 * you decide it.
 */
export function SwapRequestsScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore(state => state.user);
  const swaps = useMyShiftSwapRequests();

  if (swaps.isLoading) {
    return <LoadingView />;
  }
  if (swaps.error) {
    return (
      <ErrorState
        message={describeApiError(swaps.error, 'Could not load your swap requests.')}
        onRetry={() => swaps.refetch()}
      />
    );
  }

  const all = swaps.data?.results ?? [];
  const sent = all.filter(swap => swap.requested_by === user?.id);
  const received = all.filter(swap => swap.target_staff === user?.id);

  return (
    <Screen onRefresh={() => swaps.refetch()} refreshing={swaps.isRefetching}>
      <Button title="Request a swap" onPress={() => navigation.navigate('RequestSwap')} />

      <Text style={styles.heading}>Asking you to cover</Text>
      {received.length === 0 ? (
        <EmptyState title="Nothing here" body="Nobody's asked you to cover a shift." />
      ) : (
        received.map((swap, index) => (
          <FadeIn key={swap.id} delay={index * 40}>
            <SwapRow swap={swap} showCancel={false} />
          </FadeIn>
        ))
      )}

      <Text style={styles.heading}>Shifts you've offered</Text>
      {sent.length === 0 ? (
        <EmptyState title="Nothing here" body="Offer a shift from My shifts to see it here." />
      ) : (
        sent.map((swap, index) => (
          <FadeIn key={swap.id} delay={index * 40}>
            <SwapRow swap={swap} showCancel />
          </FadeIn>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm},
  rowHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  rowTitle: {fontSize: 14, fontWeight: '600', color: colors.text, flex: 1, marginRight: spacing.sm},
  rowBody: {fontSize: 13, color: colors.textMuted},
  note: {fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.xs},
  error: {color: colors.danger, fontSize: 12, marginTop: spacing.xs},
});
