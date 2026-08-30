import React from 'react';
import {StyleSheet, Text, TextInput, View, type TextInputProps} from 'react-native';

import {colors, spacing} from '../theme';

type TextFieldProps = TextInputProps & {
  label: string;
};

export function TextField({label, style, ...rest}: TextFieldProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={[styles.input, style]} placeholderTextColor={colors.textMuted} {...rest} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.xs},
  label: {fontSize: 13, fontWeight: '600', color: colors.textMuted},
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
});
