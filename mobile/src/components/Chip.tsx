import React from 'react';
import {Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle} from 'react-native';

import {Icon, type IconName} from './Icon';
import {colors, radii, spacing, typography} from '../theme';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
};

/**
 * A filter, one of a row of several.
 *
 * Two screens had grown their own version of this - the same border, radius
 * and amber-when-selected treatment, written twice with different padding and
 * a different label size, one of them putting white text on amber where the
 * rest of the app uses navy. Small differences, but they are the kind that
 * make two screens look like two apps.
 *
 * Selected state is carried by fill AND weight, not fill alone: amber against
 * this navy is a strong signal for most people and no signal at all for
 * someone who cannot separate the two.
 */
export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  disabled = false,
}: ChipProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{selected, disabled}}
      style={({pressed}) => [
        styles.chip,
        selected && styles.selected,
        pressed && !selected && styles.pressed,
        disabled && styles.disabled,
      ]}>
      {icon ? (
        <Icon name={icon} size="sm" color={selected ? colors.onPrimary : colors.textMuted} />
      ) : null}
      <Text style={[styles.label, selected ? styles.labelSelected : styles.labelIdle]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Lays chips out in a row that wraps.
 *
 * Wrapping rather than scrolling horizontally, which is what these rows used
 * to do: a filter that is off-screen is a filter nobody knows exists, and a
 * scroll strip gives no hint that there is more to the right.
 */
export function ChipRow({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs},
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md - 4,
  },
  selected: {backgroundColor: colors.primary, borderColor: colors.primary},
  pressed: {backgroundColor: colors.surfaceRaised},
  disabled: {opacity: 0.5},
  label: {...typography.caption},
  labelIdle: {color: colors.textMuted},
  // Navy on amber, not white: amber is bright enough that white text on it
  // fails contrast, and the rest of the app already uses onPrimary for this.
  labelSelected: {color: colors.onPrimary, fontWeight: '700'},
});
