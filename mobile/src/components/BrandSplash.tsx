import React from 'react';
import {ActivityIndicator, Image, StyleSheet, Text, View} from 'react-native';

import {TypeOn} from './TypeOn';
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
 * Matches the native splash exactly - same mark, and the same black, which
 * app.json holds as a literal because a native splash cannot read a TS token.
 * So the hand-off is invisible in a build and merely correct in Expo Go.
 */
export function BrandSplash(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Image source={logo} style={styles.mark} resizeMode="contain" />
      <Text style={styles.wordmark}>Invisiko</Text>
      {/* Typed rather than just shown: this screen exists because the session
          check takes a moment, and a line arriving says "working" where a
          static one says "stuck". */}
      <TypeOn text={TAGLINE} style={styles.tagline} speed={22} delay={200} />
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
