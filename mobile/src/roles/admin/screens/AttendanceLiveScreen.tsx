import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {spacing} from '../../../theme';

/** Who is currently checked in, right now. */
export function AttendanceLiveScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Attendance Live</Text>
      <Text>Who is currently checked in, right now.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, padding: spacing.lg, gap: spacing.sm},
  heading: {fontSize: 24, fontWeight: '600'},
});
