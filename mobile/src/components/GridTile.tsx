import React, {useRef} from 'react';
import {Animated, Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

import {colors, radii, spacing, typography} from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type Props = {
  icon: IconName;
  label: string;
  subtitle?: string;
  onPress: () => void;
};

/**
 * One tile in a grid menu (see the staff "My hours" hub). Presses scale the
 * tile down slightly rather than just recolouring it - a black-and-white
 * palette has no colour left to signal "pressed" with, so the motion carries
 * that instead.
 */
export function GridTile({icon, label, subtitle, onPress}: Props): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;

  function onPressIn() {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  }

  function onPressOut() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.wrap}
      accessibilityRole="button">
      <Animated.View style={[styles.tile, {transform: [{scale}]}]}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={26} color={colors.primary} />
        </View>
        <Text style={styles.label}>{label}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </Animated.View>
    </Pressable>
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
    // content and end up visibly different heights in the same row.
    height: 120,
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
