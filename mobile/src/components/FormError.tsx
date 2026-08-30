import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, radii, spacing, typography} from '../theme';

/** Form-level failure - the ones describeApiError produces. */
export function FormError({message}: {message?: string | null}): React.JSX.Element | null {
  if (!message) {
    return null;
  }
  return (
    <View style={styles.box} accessibilityRole="alert">
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surfaceRaised,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  text: {...typography.caption, color: colors.danger},
});
