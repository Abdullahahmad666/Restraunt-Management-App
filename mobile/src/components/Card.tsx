import React from 'react';
import {StyleSheet, View, type ViewProps} from 'react-native';

import {colors, radii, spacing} from '../theme';

export function Card({style, children, ...rest}: ViewProps): React.JSX.Element {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
});
