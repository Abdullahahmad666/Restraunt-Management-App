import {forwardRef, useState} from 'react';
import {StyleSheet, Text, TextInput, type TextInputProps, View} from 'react-native';

import {colors, radii, spacing, typography} from '../theme';

type Props = TextInputProps & {
  label: string;
  /** Field-level message from the server, shown under the input. */
  error?: string | null;
  hint?: string;
};

/**
 * A labelled text input.
 *
 * Exists so the auth screens cannot drift apart: four screens hand-rolling the
 * same input is how one ends up with a different border radius and a
 * placeholder nobody can read on a dark background.
 */
export const Field = forwardRef<TextInput, Props>(function FieldInput(
  {label, error, hint, style, ...rest},
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        style={[styles.input, focused && styles.inputFocused, !!error && styles.inputError, style]}
        placeholderTextColor={colors.textMuted}
        onFocus={e => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={e => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        {...rest}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {gap: spacing.xs},
  label: {...typography.caption, color: colors.textMuted},
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.text,
    minHeight: 52,
  },
  inputFocused: {borderColor: colors.primary},
  inputError: {borderColor: colors.danger},
  error: {...typography.caption, color: colors.danger},
  hint: {...typography.caption, color: colors.textMuted},
});
