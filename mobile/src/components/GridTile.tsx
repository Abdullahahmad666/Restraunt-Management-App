import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

import {PressableScale} from './PressableScale';
import {colors, radii, spacing, typography} from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type Props = {
  icon: IconName;
  label: string;
  subtitle?: string;
  onPress: () => void;
};

/**
 * One tile in a grid menu (see the staff "My hours" hub).
 *
 * Dips further on press than a button does - it is a much larger surface, and
 * the same small dip on something this size barely registers.
 */
export function GridTile({icon, label, subtitle, onPress}: Props): React.JSX.Element {
  return (
    <PressableScale onPress={onPress} scaleTo={0.95} style={styles.wrap} accessibilityRole="button">
      <View style={styles.tile}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={26} color={colors.primary} />
        </View>
        <Text style={styles.label} numberOfLines={2} ellipsizeMode="tail">
          {label}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
            {subtitle}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // No width here on purpose - the caller (a grid row, or a FadeIn wrapper
  // inside one) decides how wide a slot is. Sizing it here too, on top of a
  // parent that's already sized to a fraction of the row, compounds into a
  // tile far narrower than intended.
  wrap: {width: '100%'},
  tile: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    // A fixed height, not minHeight - a tile with a subtitle and one without
    // (Notifications has no subtitle) would otherwise size to their own
    // content and end up visibly different heights in the same row. Tall
    // enough for a label that wraps to two lines (numberOfLines caps it
    // there), with overflow hidden as a hard backstop against text ever
    // spilling past the tile's border.
    height: 132,
    overflow: 'hidden',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  label: {...typography.body, fontWeight: '700', color: colors.text},
  subtitle: {...typography.caption, color: colors.textMuted},
});
