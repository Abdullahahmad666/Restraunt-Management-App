import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, spacing, typography} from '../../../theme';

/** The staff member's assigned checks for today. */
export function DailyChecksScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Daily Checks</Text>
      <Text style={styles.body}>The staff member's assigned checks for today.</Text>
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
