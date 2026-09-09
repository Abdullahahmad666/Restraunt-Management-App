import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Badge} from '../../../components/Badge';
import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {FadeIn} from '../../../components/FadeIn';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {describeApiError} from '../../../api/errors';
import {useShifts} from '../../../features/attendance/hooks';
import {JOB_TITLE_LABELS} from '../../../features/attendance/types';
import {useStaffAccounts} from '../../../features/staff/hooks';
import type {StaffAccount} from '../../../features/staff/types';
import {useAuthStore} from '../../../store/authStore';
import {colors, spacing} from '../../../theme';
import {fullName} from '../../../utils/format';
import type {AdminStackParamList} from '../../../navigation/types';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

/** The full roster: the manager themselves, then every staff account, each
 * with whatever role they're next scheduled for. */
export function AllStaffScreen(): React.JSX.Element {
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

  return (
    <Screen onRefresh={() => staff.refetch()} refreshing={staff.isRefetching}>
      {manager ? (
        <Card>
          <View style={styles.rowHeader}>
            <View>
              <Text style={styles.rowTitle}>{fullName(manager)}</Text>
              <Text style={styles.rowBody}>{manager.email}</Text>
            </View>
            <Badge label="Manager" tone="neutral" />
          </View>
        </Card>
      ) : null}

      {staff.data?.results.length === 0 ? (
        <EmptyState title="No staff yet" body="Invite your first team member from the Staff tab." />
      ) : (
        staff.data?.results.map((member, index) => (
          <FadeIn key={member.id} delay={index * 50}>
            <StaffRow
              member={member}
              onPress={() => navigation.navigate('StaffDetail', {staffId: member.id})}
            />
          </FadeIn>
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
          <View>
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
  rowHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  rowTitle: {fontSize: 16, fontWeight: '600', color: colors.text},
  rowBody: {fontSize: 13, color: colors.textMuted},
  badges: {alignItems: 'flex-end', gap: spacing.xs},
});
