import React from 'react';
import {StyleSheet, Text} from 'react-native';

import {Badge} from '../../../components/Badge';
import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {describeApiError} from '../../../api/errors';
import {useAllNotifications} from '../../../features/notifications/hooks';
import type {NotificationStatus} from '../../../features/notifications/types';
import {colors} from '../../../theme';
import {formatDateTime} from '../../../utils/format';

const STATUS_TONE: Record<NotificationStatus, 'neutral' | 'success' | 'danger'> = {
  PENDING: 'neutral',
  SENT: 'success',
  FAILED: 'danger',
};

/** Every notification sent to this restaurant's staff - useful for debugging delivery. */
export function NotificationsScreen(): React.JSX.Element {
  const notifications = useAllNotifications();

  if (notifications.isLoading) {
    return <LoadingView />;
  }
  if (notifications.error) {
    return (
      <ErrorState
        message={describeApiError(notifications.error, 'Could not load notifications.')}
        onRetry={() => notifications.refetch()}
      />
    );
  }

  const items = notifications.data?.results ?? [];

  return (
    <Screen onRefresh={() => notifications.refetch()} refreshing={notifications.isRefetching}>
      {items.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          body="Shift reminders and alerts will show up here."
        />
      ) : (
        items.map(item => (
          <Card key={item.id}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <Badge label={item.status} tone={STATUS_TONE[item.status]} />
            <Text style={styles.timestamp}>{formatDateTime(item.created_at)}</Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {fontSize: 15, fontWeight: '600', color: colors.text},
  body: {fontSize: 14, color: colors.textMuted},
  timestamp: {fontSize: 12, color: colors.textMuted},
});
