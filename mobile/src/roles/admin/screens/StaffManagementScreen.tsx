import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {ActionRow, ActionRowGroup} from '../../../components/ActionRow';
import {Avatar} from '../../../components/Avatar';
import {Badge} from '../../../components/Badge';
import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {ScreenHeader} from '../../../components/ScreenHeader';
import {SectionLabel} from '../../../components/SectionLabel';
import {describeApiError} from '../../../api/errors';
import {useShifts} from '../../../features/attendance/hooks';
import {JOB_TITLE_LABELS} from '../../../features/attendance/types';
import {useStaffAccounts} from '../../../features/staff/hooks';
import type {StaffAccount} from '../../../features/staff/types';
import {useAuthStore} from '../../../store/authStore';
import {colors, spacing, typography} from '../../../theme';
import {fullName} from '../../../utils/format';
import type {AdminStackParamList} from '../../../navigation/types';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

/** The roster: who's on the team, at a glance. Adding, inviting, pay rates
 * and shifts all live on their own screens now - this one just lists. */
export function StaffManagementScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const manager = useAuthStore(state => state.user);
  const staff = useStaffAccounts();

  if (staff.isLoading) {
    return <LoadingView />;
  }
  if (staff.error) {
    return (
      <ErrorState
        message={describeApiError(staff.error, 'Could not load staff.')}
        onRetry={() => staff.refetch()}
      />
    );
  }

  const members = staff.data?.results ?? [];
  const headcount = members.length === 1 ? '1 person on the team' : members.length + ' on the team';

  return (
    <Screen onRefresh={() => staff.refetch()} refreshing={staff.isRefetching}>
      <ScreenHeader icon="people" title="Staff" subtitle={headcount} />

      {/*
        Two ways to add someone, side by side, because they are a genuine
        choice rather than a ranking: invite them to set up their own account,
        or enter their details yourself. Everything else here is navigation
        and now looks like it - this used to be a horizontally scrolling strip
        where the buttons that create something were indistinguishable from
        the ones that only move you.
      */}
      <View style={styles.primaryActions}>
        <View style={styles.primaryAction}>
          <Button title="Invite staff" onPress={() => navigation.navigate('InviteStaff')} />
        </View>
        <View style={styles.primaryAction}>
          <Button
            title="Add manually"
            variant="secondary"
            onPress={() => navigation.navigate('AddStaff')}
          />
        </View>
      </View>

      <ActionRowGroup label="Attendance">
        <ActionRow
          icon="pulse"
          label="On shift now"
          detail="Who is clocked in this minute"
          onPress={() => navigation.navigate('AttendanceLive')}
        />
        <ActionRow
          icon="qr-code"
          label="Check-in QR code"
          detail="What staff scan to clock in"
          onPress={() => navigation.navigate('StaffBarcode')}
        />
      </ActionRowGroup>

      <SectionLabel label="The team" />

      {manager ? (
        <Card>
          <View style={styles.rowHeader}>
            <Avatar name={fullName(manager)} uri={manager.profile_picture} size="sm" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{fullName(manager)}</Text>
              <Text style={styles.rowBody}>{manager.email}</Text>
            </View>
            <Badge label="Manager" tone="neutral" />
          </View>
        </Card>
      ) : null}

      {members.length === 0 ? (
        <EmptyState
          icon="person-add"
          title="No staff yet"
          body="Invite your first team member, or add their details yourself."
        />
      ) : (
        members.map(member => (
          <StaffRow
            key={member.id}
            member={member}
            onPress={() => navigation.navigate('StaffDetail', {staffId: member.id})}
          />
        ))
      )}
    </Screen>
  );
}

/** The role badge is the staff member's next upcoming shift's job title, not
 * a static field - the same person can cover different roles on different
 * days (see Shift.job_title), so there is no single fixed "role" to show
 * other than whatever they're next scheduled for. */
function StaffRow({
  member,
  onPress,
}: {
  member: StaffAccount;
  onPress: () => void;
}): React.JSX.Element {
  const shifts = useShifts({staff: member.id});

  const now = Date.now();
  const nextShift = shifts.data?.results
    .filter(shift => new Date(shift.starts_at).getTime() >= now)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];

  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={styles.rowHeader}>
          {/* StaffAccount carries no picture, so this is always initials -
              which is the point: it gives every row something to scan by
              rather than two lines of text that all look alike. */}
          <Avatar name={fullName(member)} size="sm" />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{fullName(member)}</Text>
            <Text style={styles.rowBody}>{member.email}</Text>
          </View>
          <View style={styles.badges}>
            {nextShift?.job_title ? (
              <Badge label={JOB_TITLE_LABELS[nextShift.job_title]} tone="neutral" />
            ) : null}
            <Badge
              label={member.is_active ? 'Active' : 'Deactivated'}
              tone={member.is_active ? 'success' : 'neutral'}
            />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primaryActions: {flexDirection: 'row', gap: spacing.sm},
  primaryAction: {flex: 1},
  rowHeader: {flexDirection: 'row', alignItems: 'center', gap: spacing.md},
  // Takes the slack, so a long name wraps rather than pushing the badges off
  // the right edge.
  rowText: {flex: 1, gap: 1},
  rowTitle: {...typography.body, fontWeight: '600', color: colors.text},
  rowBody: {...typography.caption, color: colors.textMuted},
  badges: {alignItems: 'flex-end', gap: spacing.xs},
});
