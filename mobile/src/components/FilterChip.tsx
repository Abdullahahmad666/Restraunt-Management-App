import React from 'react';
import {StyleSheet, Text} from 'react-native';

import {PressableScale} from './PressableScale';
import {colors, radii, spacing} from '../theme';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/**
 * One filter in a row of them, where the options are a list rather than a
 * fixed set - every supplier, every warehouse, every member of staff.
 *
 * SegmentedToggle is the better control when the choices are few and known,
 * because it shows them all at once and slides between them. It cannot do this
 * job: a segmented control divides a fixed width between its options, so
 * fifteen staff names would each get a sliver. These wrap or scroll instead.
 *
 * Shaped and animated like everything else - pill, hairline border, amber when
 * picked, and the house press dip. Four screens each had their own copy of
 * this, and every one of them put white text on amber, which is the one
 * combination this palette does not allow: `onPrimary` is near-black because
 * white on amber fails contrast.
 */
export function FilterChip({label, selected, onPress}: Props): React.JSX.Element {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{selected}}
      style={[styles.chip, selected && styles.selected]}>
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    // Matches SegmentedToggle's compact height, so a screen with one of each
    // does not look like it has two different kinds of filter.
    minHeight: 34,
    justifyContent: 'center',
  },
  selected: {backgroundColor: colors.primary, borderColor: colors.primary},
  label: {fontSize: 13, color: colors.text},
  labelSelected: {color: colors.onPrimary, fontWeight: '600'},
});
