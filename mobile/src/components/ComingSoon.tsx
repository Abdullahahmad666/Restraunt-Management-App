import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {Badge} from './Badge';
import {Icon, type IconName} from './Icon';
import {colors, iconSize, radii, spacing, typography} from '../theme';

type ComingSoonProps = {
  title: string;
  body: string;
  /** Names what is coming, so the screen is not just an apology. */
  icon?: IconName;
};

/**
 * For screens whose backend app has no models or endpoints yet (food
 * wastage, equipment).
 *
 * Worth some care rather than a bare apology: an owner evaluating the app
 * will open these, and a placeholder that looks built says the feature is
 * scheduled, where left-aligned grey text says the app is unfinished. Same
 * information, opposite impression.
 */
export function ComingSoon({title, body, icon}: ComingSoonProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.iconRing}>
        <Icon name={icon ?? 'construct'} size="xl" color={colors.primary} />
      </View>
      <Badge label="Coming soon" tone="warning" />
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRing: {
    width: iconSize.xl + spacing.xl,
    height: iconSize.xl + spacing.xl,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heading: {...typography.heading, color: colors.text, textAlign: 'center'},
  body: {
    ...typography.body,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    // Long placeholder copy across a full phone width is hard to read, and
    // this screen is nothing but that copy.
    maxWidth: 320,
  },
});
