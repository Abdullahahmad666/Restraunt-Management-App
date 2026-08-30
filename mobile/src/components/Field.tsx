import {forwardRef, useState} from 'react';
import {Pressable, StyleSheet, Text, TextInput, type TextInputProps, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

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
 *
 * Any field passed `secureTextEntry` gets a reveal toggle automatically, so no
 * caller has to remember to add one. Typing a password blind on a phone
 * keyboard is the main reason people mistype it, and this app asks for one on
 * four separate screens.
 */
export const Field = forwardRef<TextInput, Props>(function FieldInput(
  {label, error, hint, style, secureTextEntry, ...rest},
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const isPassword = Boolean(secureTextEntry);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <View
        style={[
          styles.inputBox,
          focused && styles.inputBoxFocused,
          !!error && styles.inputBoxError,
        ]}>
        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={colors.textMuted}
          // Revealing means turning the flag off, not swapping the component -
          // remounting would drop the cursor to the end and lose the keyboard.
          secureTextEntry={isPassword && !revealed}
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

        {isPassword ? (
          <Pressable
            onPress={() => setRevealed(current => !current)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            style={styles.reveal}>
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={revealed ? colors.primary : colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>

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
  // The border lives on the wrapper rather than the input so the reveal button
  // sits inside it.
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  inputBoxFocused: {borderColor: colors.primary},
  inputBoxError: {borderColor: colors.danger},
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.text,
  },
  reveal: {paddingLeft: spacing.sm},
  error: {...typography.caption, color: colors.danger},
  hint: {...typography.caption, color: colors.textMuted},
});
