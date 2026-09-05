import React from 'react';
import {ActivityIndicator, Image, StyleSheet, Text, View} from 'react-native';

import {colors, spacing, TAGLINE, typography} from '../theme';

const logo = require('../../assets/images/splash-icon.png');

/**
 * Branded loading screen, shown while the stored session is being checked.
 *
 * Needed because the native splash from expo-splash-screen only exists in a
 * real build - Expo Go substitutes its own and hides it as soon as JS starts.
 * Rendering nothing during that window therefore shows white in Expo Go, which
 * is jarring in a dark app and looks like a crash.
 *
 * Matches the native splash exactly (same mark, same navy) so the hand-off is
 * invisible in a build and merely correct in Expo Go.
 */
export function BrandSplash(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Image source={logo} style={styles.mark} resizeMode="contain" />
      <Text style={styles.wordmark}>Invisiko</Text>
      <Text style={styles.tagline}>{TAGLINE}</Text>
      <ActivityIndicator color={colors.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  mark: {width: 96, height: 96},
  wordmark: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.md,
    letterSpacing: 0.5,
  },
  tagline: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  spinner: {marginTop: spacing.xl},
});
