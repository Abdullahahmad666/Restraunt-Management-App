import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {describeApiError} from '../../../api/errors';
import {useMarkNotificationRead, useMyNotifications} from '../../../features/notifications/hooks';
import type {AppNotification} from '../../../features/notifications/types';
import {colors, spacing} from '../../../theme';
import {formatDateTime} from '../../../utils/format';

/** Shift reminders, schedule changes, and anything else sent to this staff
 * member - tap one to mark it read. */
export function NotificationsScreen(): React.JSX.Element {
  const notifications = useMyNotifications();
  const markRead = useMarkNotificationRead();

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
          body="Shift reminders and schedule changes will show up here."
        />
      ) : (
        items.map(item => (
          <NotificationRow
            key={item.id}
            item={item}
            onPress={() => {
              if (!item.read_at) {
                markRead.mutate(item.id);
              }
            }}
          />
        ))
      )}
    </Screen>
  );
}

function NotificationRow({
  item,
  onPress,
}: {
  item: AppNotification;
  onPress: () => void;
}): React.JSX.Element {
  const unread = !item.read_at;

  return (
    <Pressable onPress={onPress}>
      <Card style={unread ? styles.unreadCard : undefined}>
        <View style={styles.rowHeader}>
          {unread ? <View style={styles.dot} /> : null}
          <Text style={styles.title}>{item.title}</Text>
        </View>
        <Text style={styles.body}>{item.body}</Text>
        <Text style={styles.timestamp}>{formatDateTime(item.created_at)}</Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  unreadCard: {borderColor: colors.primary},
  rowHeader: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  dot: {width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary},
  title: {fontSize: 15, fontWeight: '600', color: colors.text},
  body: {fontSize: 14, color: colors.textMuted},
  timestamp: {fontSize: 12, color: colors.textMuted},
});
