import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, spacing, typography} from '../../../theme';

/** Hours x rate per staff member over a selected pay period. */
export function PayrollScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Payroll</Text>
      <Text style={styles.body}>Hours x rate per staff member over a selected pay period.</Text>
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
