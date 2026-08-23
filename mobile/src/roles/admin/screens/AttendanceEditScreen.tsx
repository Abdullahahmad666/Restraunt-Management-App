import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {spacing} from '../../../theme';

/** Manually add or fix a record after a scanner error or missed checkout. */
export function AttendanceEditScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Attendance Edit</Text>
      <Text>Manually add or fix a record after a scanner error or missed checkout.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, padding: spacing.lg, gap: spacing.sm},
  heading: {fontSize: 24, fontWeight: '600'},
});
