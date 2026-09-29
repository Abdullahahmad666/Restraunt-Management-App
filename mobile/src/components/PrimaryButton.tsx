import React from 'react';
import {ActivityIndicator, StyleSheet, Text} from 'react-native';

import {PressableScale} from './PressableScale';
import {colors, radii, spacing, typography} from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
};

/**
 * Every button in the app.
 *
 * Shaped to match SegmentedToggle deliberately: the same pill radius, and
 * `secondary` carries the toggle track's surface and hairline border. The
 * toggle is the first control anyone meets, on the welcome screen, so the rest
 * of the app following its shape is what makes the two read as one product
 * rather than two. Presses share the house motion through PressableScale.
 *
 * The four variants are a hierarchy, not a palette: one `primary` per screen,
 * `secondary` for the alternative beside it, `danger` for something that
 * destroys data, `ghost` for a way out (cancel, dismiss) that should not
 * compete with either. Amber is the app's only colour, so a screen with two
 * filled buttons has already spent it.
 *
 * `loading` keeps the button mounted and swaps the label for a spinner, rather
 * than replacing the button with one. Swapping the whole control makes the
 * layout jump and, worse, moves whatever is underneath it up under the user's
 * thumb mid-tap.
 */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
}: Props): React.JSX.Element {
  const inactive = disabled || loading;

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{disabled: inactive, busy: loading}}
      style={[styles.base, surfaces[variant], inactive && styles.inactive]}>
      {loading ? (
        <ActivityIndicator color={INK[variant]} />
      ) : (
        <Text style={[styles.label, {color: INK[variant]}]}>{label}</Text>
      )}
    </PressableScale>
  );
}

/** What sits on each surface - the spinner and the label always agree. */
const INK: Record<ButtonVariant, string> = {
  primary: colors.onPrimary,
  secondary: colors.text,
  danger: colors.danger,
  ghost: colors.textMuted,
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    // Comfortably past the 44pt minimum tap target on both platforms, and the
    // same height as a filled and an outlined button so a stacked pair does
    // not step.
    minHeight: 52,
  },
  inactive: {opacity: 0.5},
  label: {...typography.body, fontWeight: '700'},
});

const surfaces = StyleSheet.create({
  primary: {backgroundColor: colors.primary},
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  // No border and no fill: present, but clearly the quieter half of a pair.
  ghost: {backgroundColor: 'transparent'},
});
