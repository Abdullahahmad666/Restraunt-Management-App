import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {ActionRow, ActionRowGroup} from '../../../components/ActionRow';
import {Icon} from '../../../components/Icon';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {ScreenHeader} from '../../../components/ScreenHeader';
import {useLiveLogs} from '../../../features/attendance/hooks';
import {useSignOut} from '../../../features/auth/useSignOut';
import {useStaffAccounts} from '../../../features/staff/hooks';
import {useAuthStore} from '../../../store/authStore';
import {colors, radii, spacing, typography} from '../../../theme';
import type {IconName} from '../../../components/Icon';
import type {AdminStackParamList} from '../../../navigation/types';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

/** Who's on shift right now, and the shortcuts an owner reaches for most. */
export function DashboardScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore(state => state.user);
  const signOut = useSignOut();
  const live = useLiveLogs();
  const staff = useStaffAccounts();

  if (live.isLoading || staff.isLoading) {
    return <LoadingView />;
  }

  const onShiftCount = live.data?.length ?? 0;
  const activeStaffCount = staff.data?.results.filter(member => member.is_active).length ?? 0;

  return (
    <Screen onRefresh={() => live.refetch()} refreshing={live.isRefetching}>
      <ScreenHeader
        title={`Hi, ${user?.first_name ?? 'there'}`}
        subtitle="Here's your floor right now."
      />

      {/*
        The two numbers a manager opens the app for, so they come before any
        navigation. Tapping through to the live list is the obvious next
        question after seeing the count, which is why the first one is a
        Pressable and reads as a card rather than a statistic on a slab.
      */}
      <View style={styles.statsRow}>
        <StatCard
          icon="pulse"
          value={onShiftCount}
          label="On shift now"
          onPress={() => navigation.navigate('AttendanceLive')}
        />
        <StatCard icon="people" value={activeStaffCount} label="Active staff" />
      </View>

      {/*
        Grouped rows rather than the five identical secondary buttons this
        replaces: a manager could not tell payroll from notifications without
        reading all five, and a stack of filled-weight controls left nothing
        louder for whatever a screen actually wants doing.
      */}
      <ActionRowGroup label="Team">
        <ActionRow
          icon="time"
          label="Attendance history"
          detail="Past shifts, and corrections"
          onPress={() => navigation.navigate('AttendanceHistory', {})}
        />
        <ActionRow
          icon="cash"
          label="Payroll"
          detail="Hours and pay by period"
          onPress={() => navigation.navigate('Payroll')}
        />
      </ActionRowGroup>

      <ActionRowGroup label="Setup">
        <ActionRow
          icon="qr-code"
          label="Check-in QR code"
          detail="What staff scan to clock in"
          onPress={() => navigation.navigate('StaffBarcode')}
        />
        <ActionRow
          icon="notifications"
          label="Notifications"
          onPress={() => navigation.navigate('Notifications')}
        />
      </ActionRowGroup>

      <ActionRowGroup label="Account">
        <ActionRow
          icon="person"
          label="My profile"
          detail={user?.email}
          onPress={() => navigation.navigate('Profile')}
        />
        {/* Was a "Sign out" button beside the greeting, where it competed
            with the heading for the eye and got the emphasis of a primary
            action. It belongs with the account, in the tone it deserves. */}
        <ActionRow icon="log-out" label="Sign out" tone="danger" onPress={signOut} />
      </ActionRowGroup>
    </Screen>
  );
}

type StatCardProps = {
  icon: IconName;
  value: number;
  label: string;
  onPress?: () => void;
};

/**
 * The count leads, at display size, because that is the thing being read -
 * the label underneath only says what it counts. The icon sits small and
 * muted in the corner: it identifies the card without competing with the
 * number, which is the one piece of amber on the card.
 */
function StatCard({icon, value, label, onPress}: StatCardProps): React.JSX.Element {
  const body = (
    <>
      <View style={styles.statTop}>
        <Text style={styles.statValue}>{value}</Text>
        <Icon name={icon} size="md" color={colors.textMuted} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </>
  );

  if (!onPress) {
    return <View style={styles.statCard}>{body}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      style={({pressed}) => [styles.statCard, pressed && styles.statCardPressed]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  statsRow: {flexDirection: 'row', gap: spacing.md},
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  statCardPressed: {backgroundColor: colors.surfaceRaised},
  // Baseline rather than centre: the icon lines up with the top of the
  // numerals instead of floating against their middle.
  statTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  statValue: {...typography.display, color: colors.primary},
  statLabel: {...typography.caption, color: colors.textMuted},
});
