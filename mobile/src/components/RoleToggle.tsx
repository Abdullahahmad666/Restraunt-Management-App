import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

import {colors, radii, spacing, typography} from '../theme';
import {ROLES, type Role} from '../types/roles';

type Props = {
  value: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const OPTIONS: {role: Role; label: string; icon: IconName; caption: string}[] = [
  {
    role: ROLES.STAFF,
    label: 'Staff',
    icon: 'person-outline',
    caption: 'Scan in and out, run the daily checks.',
  },
  {
    role: ROLES.ADMIN,
    label: 'Admin',
    icon: 'shield-checkmark-outline',
    caption: 'Manage the team, records and pay.',
  },
];

/**
 * Segmented Staff/Admin selector for signup.
 *
 * Built from Pressables rather than a native segmented control so it can be
 * styled to the brand on both platforms - iOS's own is light-mode-flavoured
 * and does not take an icon.
 *
 * The per-option description sits under the control rather than inside it, and
 * only the selected one is shown. Two captions stacked inside the segments
 * forced them to ~68pt and made the whole thing read as a pair of cards rather
 * than one control; a single line below keeps it compact and says the same
 * thing, since only the selection matters once a choice is made.
 *
 * Choosing Admin grants nothing by itself: the server requires a matching
 * invite code, because an admin can edit the attendance records that decide
 * what people are paid.
 */
export function RoleToggle({value, onChange, disabled = false}: Props): React.JSX.Element {
  const selected = OPTIONS.find(option => option.role === value) ?? OPTIONS[0]!;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>I am signing up as</Text>

      <View style={[styles.track, disabled && styles.trackDisabled]} accessibilityRole="radiogroup">
        {OPTIONS.map(option => {
          const active = option.role === value;
          return (
            <Pressable
              key={option.role}
              onPress={() => onChange(option.role)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{selected: active, disabled}}
              accessibilityLabel={`${option.label}. ${option.caption}`}
              style={({pressed}) => [
                styles.option,
                active && styles.optionActive,
                pressed && !disabled && !active && styles.optionPressed,
              ]}>
              <Ionicons
                name={option.icon}
                size={16}
                color={active ? colors.onPrimary : colors.textMuted}
              />
              <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.caption}>{selected.caption}</Text>
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
    borderRadius: radii.md,
    padding: 3,
    gap: 3,
  },
  trackDisabled: {opacity: 0.5},
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    minHeight: 40,
  },
  optionActive: {backgroundColor: colors.primary},
  optionPressed: {backgroundColor: colors.surfaceRaised},
  optionLabel: {...typography.body, fontWeight: '700', color: colors.textMuted},
  optionLabelActive: {color: colors.onPrimary},
  caption: {...typography.caption, color: colors.textMuted},
});
