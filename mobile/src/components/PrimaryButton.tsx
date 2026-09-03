import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text} from 'react-native';

import {colors, radii, spacing, typography} from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
};

/**
 * The one filled button.
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
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{disabled: inactive, busy: loading}}
      style={({pressed}) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        pressed && !inactive && styles.pressed,
        inactive && styles.inactive,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onPrimary : colors.text} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' ? styles.labelOnPrimary : styles.labelOnDark,
          ]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primary: {backgroundColor: colors.primary},
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  pressed: {opacity: 0.85},
  inactive: {opacity: 0.5},
  label: {...typography.body, fontWeight: '700'},
  labelOnPrimary: {color: colors.onPrimary},
  labelOnDark: {color: colors.text},
});
