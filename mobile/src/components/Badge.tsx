import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, radii, spacing, typography} from '../theme';

type Tone = 'neutral' | 'success' | 'warning' | 'danger';

type BadgeProps = {
  label: string;
  tone?: Tone;
};

export function Badge({label, tone = 'neutral'}: BadgeProps): React.JSX.Element {
  return (
    <View style={[styles.badge, toneStyles[tone]]}>
      <Text style={[styles.label, tone !== 'neutral' && styles.labelOnColor]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm + 2,
  },
  label: {...typography.caption, fontSize: 12, fontWeight: '700', color: colors.textMuted},
  // Dark ink, not white. All three status colours are lightened to carry on a
  // navy ground, which leaves white text on them well under 4.5:1 - the
  // warning amber worst of all.
  labelOnColor: {color: colors.onPrimary},
});

const toneStyles = StyleSheet.create({
  neutral: {backgroundColor: colors.border},
  success: {backgroundColor: colors.success},
  warning: {backgroundColor: colors.warning},
  danger: {backgroundColor: colors.danger},
});
