import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors} from '../theme';

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
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  label: {fontSize: 12, fontWeight: '700', color: colors.textMuted},
  // Near-black, not white. Every status colour here is a lightened one -
  // mid-tone greens and reds go muddy against a dark app - and white on a
  // lightened green or amber is the pairing that fails contrast.
  labelOnColor: {color: colors.background},
});

const toneStyles = StyleSheet.create({
  neutral: {backgroundColor: colors.border},
  success: {backgroundColor: colors.success},
  warning: {backgroundColor: colors.warning},
  danger: {backgroundColor: colors.danger},
});
