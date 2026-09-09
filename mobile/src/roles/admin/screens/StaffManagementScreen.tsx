import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {FadeIn} from '../../../components/FadeIn';
import {GridTile} from '../../../components/GridTile';
import {Screen} from '../../../components/Screen';
import {colors, spacing} from '../../../theme';
import type {AdminStackParamList} from '../../../navigation/types';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

/** The Staff hub: who's in right now, how to invite someone new, and the
 * full roster - each its own screen, reached from here. */
export function StaffManagementScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();

  return (
    <Screen>
      <Text style={styles.heading}>Staff</Text>

      <View style={styles.grid}>
        <FadeIn delay={40} style={styles.tileWrap}>
          <GridTile
            icon="time-outline"
            label="On shift now"
            subtitle="Who's checked in"
            onPress={() => navigation.navigate('AttendanceLive')}
          />
        </FadeIn>
        <FadeIn delay={80} style={styles.tileWrap}>
          <GridTile
            icon="link-outline"
            label="Invite staff"
            subtitle="Share a code"
            onPress={() => navigation.navigate('InviteStaff')}
          />
        </FadeIn>
        <FadeIn delay={120} style={styles.tileWrap}>
          <GridTile
            icon="people-outline"
            label="All staff"
            subtitle="Roster & roles"
            onPress={() => navigation.navigate('AllStaff')}
          />
        </FadeIn>
        <FadeIn delay={160} style={styles.tileWrap}>
          <GridTile
            icon="calendar-clear-outline"
            label="Attendance history"
            subtitle="Every check-in"
            onPress={() => navigation.navigate('AttendanceHistory', {})}
          />
        </FadeIn>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 24, fontWeight: '700', color: colors.text},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between'},
  tileWrap: {width: '48%'},
});
