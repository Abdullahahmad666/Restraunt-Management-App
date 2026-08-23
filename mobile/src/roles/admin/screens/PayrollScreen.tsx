import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {spacing} from '../../../theme';

/** Hours x rate per staff member over a selected pay period. */
export function PayrollScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Payroll</Text>
      <Text>Hours x rate per staff member over a selected pay period.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, padding: spacing.lg, gap: spacing.sm},
  heading: {fontSize: 24, fontWeight: '600'},
});
