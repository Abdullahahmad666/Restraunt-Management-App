import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, spacing, typography} from '../../../theme';

/** Own hours and estimated pay for the current pay period. */
export function MyPayScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Pay</Text>
      <Text style={styles.body}>Own hours and estimated pay for the current pay period.</Text>
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
