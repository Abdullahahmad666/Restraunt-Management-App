import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text} from 'react-native';

import {colors, radii, spacing} from '../theme';

type Variant = 'primary' | 'secondary' | 'danger';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: ButtonProps): React.JSX.Element {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({pressed}) => [
        styles.base,
        variantStyles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.primary : '#FFFFFF'} />
      ) : (
        <Text style={[styles.label, variant === 'secondary' && styles.labelSecondary]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {opacity: 0.85},
  disabled: {opacity: 0.5},
  label: {color: '#FFFFFF', fontSize: 16, fontWeight: '600'},
  labelSecondary: {color: colors.primary},
});

const variantStyles = StyleSheet.create({
  primary: {backgroundColor: colors.primary},
  secondary: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary},
  danger: {backgroundColor: colors.danger},
});
