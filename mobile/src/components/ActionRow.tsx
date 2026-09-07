import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {Icon, IconBadge, type IconName} from './Icon';
import {colors, radii, spacing, typography} from '../theme';

type ActionRowProps = {
  icon: IconName;
  label: string;
  /** What this leads to, or its current state - "3 pending", "Not set up". */
  detail?: string;
  /** A short value shown on the right, before the chevron. */
  value?: string;
  tone?: 'primary' | 'neutral' | 'success' | 'warning' | 'danger';
  onPress: () => void;
  disabled?: boolean;
};

/**
 * A row that goes somewhere.
 *
 * The alternative, and what this replaces, was a column of identical
 * secondary buttons: the admin dashboard offered five in a stack, every one
 * the same size and colour, which gave a manager no way to tell payroll from
 * notifications without reading all five. It also spent the app's strongest
 * visual signal - a filled button - on navigation, leaving nothing louder for
 * the action a screen actually wants.
 *
 * Rows fix both. The icon badge makes each one identifiable before it is
 * read, the chevron says "this leads somewhere" rather than "this does
 * something", and a filled button on the same screen now clearly outranks
 * them.
 */
export function ActionRow({
  icon,
  label,
  detail,
  value,
  tone = 'primary',
  onPress,
  disabled = false,
}: ActionRowProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      accessibilityState={{disabled}}
      style={({pressed}) => [styles.row, pressed && styles.pressed, disabled && styles.disabled]}>
      <IconBadge name={icon} tone={tone} size="sm" />

      <View style={styles.text}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {detail ? (
          <Text style={styles.detail} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>

      {value ? <Text style={styles.value}>{value}</Text> : null}
      <Icon name="chevron-forward" size="sm" color={colors.textMuted} />
    </Pressable>
  );
}

/**
 * Groups rows into one panel with hairlines between them, the way a settings
 * list reads. Separate cards per row would restate the same border four times
 * and turn a list into a scattering of tiles.
 */
export function ActionRowGroup({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const rows = React.Children.toArray(children).filter(Boolean);

  return (
    <View style={styles.groupBlock}>
      {label ? <Text style={styles.groupLabel}>{label}</Text> : null}
      <View style={styles.group}>
        {rows.map((row, index) => (
          // Index is a safe key here: these are a fixed, hand-written list per
          // screen, never a reordered or filtered collection.
          <View key={index} style={index > 0 ? styles.divider : undefined}>
            {row}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    // 56 with the badge inside clears the 44pt tap target comfortably.
    minHeight: 56,
  },
  pressed: {backgroundColor: colors.surfaceRaised},
  disabled: {opacity: 0.5},
  text: {flex: 1, gap: 1},
  label: {...typography.body, fontWeight: '600', color: colors.text},
  detail: {...typography.caption, color: colors.textMuted},
  value: {...typography.caption, fontWeight: '600', color: colors.primary},

  groupBlock: {gap: spacing.sm},
  groupLabel: {
    ...typography.overline,
    color: colors.textMuted,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.xs,
  },
  group: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    // Rows paint their own pressed background to the panel's edge, so it has
    // to be clipped to the rounded corner.
    overflow: 'hidden',
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    // Inset to where the labels start (16 padding + 36 badge + 16 gap), so
    // the line runs down the text column instead of cutting under the icons.
    marginLeft: spacing.md + 36 + spacing.md,
  },
});
