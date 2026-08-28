import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, spacing, typography} from '../../../theme';

/** The full trail, as presented at a hygiene inspection. */
export function ComplianceHistoryScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Compliance History</Text>
      <Text style={styles.body}>The full trail, as presented at a hygiene inspection.</Text>
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
