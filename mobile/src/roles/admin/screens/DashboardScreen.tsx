import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {useLiveLogs} from '../../../features/attendance/hooks';
import {useSignOut} from '../../../features/auth/useSignOut';
import {useStaffAccounts} from '../../../features/staff/hooks';
import {useAuthStore} from '../../../store/authStore';
import {colors, spacing} from '../../../theme';
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
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Hi, {user?.first_name}</Text>
        <Button title="Sign out" variant="secondary" onPress={signOut} />
      </View>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{onShiftCount}</Text>
          <Text style={styles.statLabel}>On shift now</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{activeStaffCount}</Text>
          <Text style={styles.statLabel}>Active staff</Text>
        </Card>
      </View>

      <View style={styles.actions}>
        <Button
          title="Attendance history"
          variant="secondary"
          onPress={() => navigation.navigate('AttendanceHistory', {})}
        />
        <Button
          title="Payroll"
          variant="secondary"
          onPress={() => navigation.navigate('Payroll')}
        />
        <Button
          title="Check-in QR code"
          variant="secondary"
          onPress={() => navigation.navigate('StaffBarcode')}
        />
        <Button
          title="Notifications"
          variant="secondary"
          onPress={() => navigation.navigate('Notifications')}
        />
        <Button
          title="My profile"
          variant="secondary"
          onPress={() => navigation.navigate('Profile')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  heading: {fontSize: 24, fontWeight: '700', color: colors.text},
  statsRow: {flexDirection: 'row', gap: spacing.md},
  statCard: {flex: 1, alignItems: 'center'},
  statValue: {fontSize: 28, fontWeight: '700', color: colors.primary},
  statLabel: {fontSize: 13, color: colors.textMuted},
  actions: {gap: spacing.sm, marginTop: spacing.sm},
});
