import React from 'react';
import {KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type ViewStyle} from 'react-native';

import {colors, spacing} from '../theme';

/**
 * Layout shared by every pre-login screen.
 *
 * The keyboard handling is the point: without it the sign-in button sits under
 * the keyboard on a small phone and there is no way to reach it.
 */
export function AuthScreen({
  children,
  contentStyle,
}: {
  children: React.ReactNode;
  contentStyle?: ViewStyle;
}): React.JSX.Element {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: colors.background},
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
});
