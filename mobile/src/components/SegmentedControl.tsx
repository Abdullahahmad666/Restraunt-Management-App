import React, {useEffect, useRef, useState} from 'react';
import {Animated, Pressable, StyleSheet, Text, View} from 'react-native';

import {Icon, type IconName} from './Icon';
import {colors, elevation, radii, spacing, typography} from '../theme';

export type Segment<T extends string> = {
  value: T;
  label: string;
  icon?: IconName;
};

type Props<T extends string> = {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Announced as a group, since the labels alone rarely say what is being
   * chosen. */
  accessibilityLabel?: string;
};

/**
 * A two-or-more-way choice with a thumb that slides between options.
 *
 * The movement is the point, and the reason this is not just two Pressables
 * that swap background colour. A thumb that travels tells you the two options
 * are one setting with one answer; a colour swap reads as two separate
 * buttons, one of which happens to be highlighted. It is the difference
 * between a control and a pair of tabs that lost their bar.
 *
 * Width comes from onLayout rather than a fixed number so the thumb tracks
 * whatever the container ends up being - inside a padded screen, a card, or
 * next to something else - instead of being right on one phone and wrong on
 * every other.
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  disabled = false,
  accessibilityLabel,
}: Props<T>): React.JSX.Element {
  const [trackWidth, setTrackWidth] = useState(0);
  const index = Math.max(
    0,
    segments.findIndex(segment => segment.value === value),
  );

  // Starts at the current position rather than animating in from the left on
  // first render - a control that slides into place as the screen opens looks
  // like something went wrong.
  const offset = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    Animated.spring(offset, {
      toValue: index,
      useNativeDriver: true,
      // Critically damped-ish: it arrives quickly and does not wobble, which
      // on a control this small would read as a glitch rather than as bounce.
      stiffness: 240,
      damping: 24,
      mass: 0.7,
    }).start();
  }, [index, offset]);

  const segmentWidth = trackWidth > 0 ? (trackWidth - PADDING * 2) / segments.length : 0;

  return (
    <View
      style={styles.track}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={event => {
        const width = event.nativeEvent.layout.width;
        // Only on a real change: onLayout fires on every re-layout and
        // setState with the same number would still re-render.
        setTrackWidth(previous => (previous === width ? previous : width));
      }}>
      {segmentWidth > 0 ? (
        <Animated.View
          // Decoration - the selected state is on the segments themselves,
          // where a screen reader will find it.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              width: segmentWidth,
              transform: [
                {
                  translateX: offset.interpolate({
                    inputRange: segments.map((_, i) => i),
                    outputRange: segments.map((_, i) => i * segmentWidth),
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}

      {segments.map(segment => {
        const active = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            // Only when it changes: re-reporting the current value would make
            // a host that navigates on change fire on every tap.
            onPress={() => segment.value !== value && onChange(segment.value)}
            disabled={disabled}
            accessibilityRole="tab"
            accessibilityState={{selected: active, disabled}}
            style={styles.segment}>
            {segment.icon ? (
              <Icon
                name={segment.icon}
                size="sm"
                color={active ? colors.onPrimary : colors.textMuted}
              />
            ) : null}
            <Text
              numberOfLines={1}
              style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The track's inner padding, shared by the layout maths above. */
const PADDING = 3;

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    padding: PADDING,
  },
  thumb: {
    position: 'absolute',
    top: PADDING,
    left: PADDING,
    bottom: PADDING,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    ...elevation.low,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    // 40 keeps the control near a comfortable tap target without the bulk of
    // two stacked buttons, which is what it replaces.
    height: 40,
  },
  label: {...typography.caption, fontWeight: '600'},
  labelActive: {color: colors.onPrimary},
  labelInactive: {color: colors.textMuted},
});
