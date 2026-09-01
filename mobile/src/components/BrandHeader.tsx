import React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';

import {colors, spacing, TAGLINE, typography} from '../theme';

// The same mark the splash shows, so the hand-off reads as one screen.
const logo = require('../../assets/images/splash-icon.png');

type Props = {
  /** Shown under the wordmark. Defaults to the product tagline. */
  subtitle?: string;
  compact?: boolean;
};

/** Logo, wordmark and a line of context. Shared by every pre-login screen. */
export function BrandHeader({subtitle, compact = false}: Props): React.JSX.Element {
  return (
    <View style={[styles.container, compact && styles.compact]}>
      <Image
        source={logo}
        style={compact ? styles.logoCompact : styles.logo}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <Text style={styles.wordmark}>Invisiko</Text>
      <Text style={styles.subtitle}>{subtitle ?? TAGLINE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {alignItems: 'center', marginBottom: spacing.xl},
  compact: {marginBottom: spacing.lg},
  logo: {width: 88, height: 88},
  logoCompact: {width: 56, height: 56},
  wordmark: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.md,
    letterSpacing: 0.5,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});
