import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, spacing, typography} from '../../../theme';

/** This staff member's own scan history for the current period. */
export function MyAttendanceScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Attendance</Text>
      <Text style={styles.body}>This staff member's own scan history for the current period.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  heading: {...typography.heading, color: colors.text},
  body: {...typography.body, color: colors.textMuted},
});
