import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, spacing, typography} from '../../../theme';

/** Fridges, freezers and probes, and their safe ranges. */
export function EquipmentScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Equipment</Text>
      <Text style={styles.body}>Fridges, freezers and probes, and their safe ranges.</Text>
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
