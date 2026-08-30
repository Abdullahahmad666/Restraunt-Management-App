import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {colors, radii, spacing, typography} from '../theme';
import {ROLES, type Role} from '../types/roles';

type Props = {
  value: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
};

const OPTIONS: {role: Role; label: string; caption: string}[] = [
  {role: ROLES.STAFF, label: 'Staff', caption: 'Scan in, run daily checks'},
  {role: ROLES.ADMIN, label: 'Admin', caption: 'Manage the team and records'},
];

/**
 * Segmented Staff/Admin selector for signup.
 *
 * Built from Pressables rather than a native segmented control so it can carry
 * a caption per option and be styled to the brand on both platforms - iOS's
 * own control is light-mode-flavoured and does not take a second line.
 *
 * Choosing Admin does not by itself grant anything: the server requires a
 * matching invite code, because an admin can edit the attendance records that
 * decide what people are paid.
 */
export function RoleToggle({value, onChange, disabled = false}: Props): React.JSX.Element {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>I am signing up as</Text>

      <View style={[styles.track, disabled && styles.trackDisabled]} accessibilityRole="radiogroup">
        {OPTIONS.map(option => {
          const selected = option.role === value;
          return (
            <Pressable
              key={option.role}
              onPress={() => onChange(option.role)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{selected, disabled}}
              accessibilityLabel={`${option.label}. ${option.caption}`}
              style={({pressed}) => [
                styles.option,
                selected && styles.optionSelected,
                pressed && !disabled && !selected && styles.optionPressed,
              ]}>
              <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                {option.label}
              </Text>
              <Text
                style={[styles.optionCaption, selected && styles.optionCaptionSelected]}
                numberOfLines={2}>
                {option.caption}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {gap: spacing.xs},
  label: {...typography.caption, color: colors.textMuted},
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  trackDisabled: {opacity: 0.5},
  option: {
    flex: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: 2,
    minHeight: 68,
    justifyContent: 'center',
  },
  optionSelected: {backgroundColor: colors.primary},
  optionPressed: {backgroundColor: colors.surfaceRaised},
  optionLabel: {...typography.body, fontWeight: '700', color: colors.text},
  optionLabelSelected: {color: colors.onPrimary},
  optionCaption: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  // Navy on amber, at the low opacity that reads as secondary without
  // dropping under the contrast a caption needs to stay legible.
  optionCaptionSelected: {color: colors.onPrimary, opacity: 0.75},
});
