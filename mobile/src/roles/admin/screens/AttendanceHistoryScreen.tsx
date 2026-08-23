import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {spacing} from '../../../theme';

/** Filterable attendance history per staff member by date range. */
export function AttendanceHistoryScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Attendance History</Text>
      <Text>Filterable attendance history per staff member by date range.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, padding: spacing.lg, gap: spacing.sm},
  heading: {fontSize: 24, fontWeight: '600'},
});
