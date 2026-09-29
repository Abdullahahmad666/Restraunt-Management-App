import React, {useEffect, useRef, useState} from 'react';
import {Animated, Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

import {colors, radii, spacing} from '../theme';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Optional: an icon earns its place when it names a *kind* of person or
   * thing ("Manager", "Staff"). On a filter row of plain adjectives - All, On
   * shift, Closed - it decorates without adding meaning, and eats the width
   * the labels need. */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
};

/**
 * A two-or-more way switch: one visible choice, the alternatives named beside
 * it rather than hidden behind a menu.
 *
 * Used where the options are few and the difference between them matters
 * enough to be worth showing - someone who has been sent an invite code needs
 * to see that "Staff" is where they belong before they start tapping.
 *
 * The moving pill is RN's own Animated on the native driver, the same as
 * FadeIn. Sliding it rather than recolouring two boxes is what makes the
 * unpicked option read as still available instead of disabled.
 */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  compact = false,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  /** Sized to sit above a list as a filter rather than to be the thing on
   * screen someone came to press. */
  compact?: boolean;
}): React.JSX.Element {
  const [trackWidth, setTrackWidth] = useState(0);
  const index = Math.max(
    options.findIndex(option => option.value === value),
    0,
  );
  const position = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    const animation = Animated.timing(position, {
      toValue: index,
      duration: 220,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, position]);

  const segmentWidth = trackWidth > 0 ? (trackWidth - PADDING * 2) / options.length : 0;

  return (
    <View
      style={styles.track}
      onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}>
      {/* Rendered only once the track has been measured - a pill that starts
          at zero width and jumps to the right place is worse than one that
          appears already in it. */}
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              width: segmentWidth,
              transform: [
                {
                  translateX: position.interpolate({
                    inputRange: options.map((_, i) => i),
                    outputRange: options.map((_, i) => i * segmentWidth),
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}

      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, compact && styles.segmentCompact]}
            accessibilityRole="tab"
            accessibilityState={{selected}}
            accessibilityLabel={option.label}>
            {option.icon ? (
              <Ionicons
                name={option.icon}
                size={compact ? 14 : 16}
                color={selected ? colors.onPrimary : colors.textMuted}
              />
            ) : null}
            <Text
              style={[
                styles.label,
                compact && styles.labelCompact,
                selected && styles.labelSelected,
              ]}
              numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const PADDING = 4;

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: PADDING,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  indicator: {
    position: 'absolute',
    top: PADDING,
    left: PADDING,
    bottom: PADDING,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  segmentCompact: {paddingVertical: spacing.xs},
  label: {fontSize: 14, fontWeight: '600', color: colors.textMuted},
  labelCompact: {fontSize: 13},
  labelSelected: {color: colors.onPrimary},
});
