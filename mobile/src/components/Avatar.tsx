import React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';

import {colors, radii, typography} from '../theme';

type AvatarProps = {
  /** Full name - initials are taken from it. */
  name: string;
  /** A profile picture, when the record has one. */
  uri?: string | null;
  size?: 'sm' | 'md';
};

/**
 * Initials from a name: at most two, first and last word.
 *
 * A single-word name gives one letter rather than two from the same word -
 * "MO" for "Mohsin" reads as a second name that isn't there.
 */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? words[words.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase();
}

/**
 * A person, in a roster row or at the head of their own screen.
 *
 * The staff list used to be name-and-email text in a card, which made one
 * person indistinguishable from the next until you read them. Initials give
 * every row something to recognise at a glance and scan by, and they cost
 * nothing: StaffAccount carries no picture, so a photo-shaped hole would only
 * ever be a grey circle.
 *
 * Circular, unlike IconBadge's squircle - that distinction is what keeps a
 * person visually separate from a category on screens that list both.
 */
export function Avatar({name, uri, size = 'md'}: AvatarProps): React.JSX.Element {
  if (uri) {
    return (
      <Image
        source={{uri}}
        style={[styles.base, sizeStyles[size]]}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View style={[styles.base, styles.fallback, sizeStyles[size]]}>
      <Text style={[styles.initials, size === 'sm' && styles.initialsSm]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {alignItems: 'center', justifyContent: 'center'},
  fallback: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  initials: {...typography.subheading, color: colors.textMuted, letterSpacing: 0.5},
  initialsSm: {...typography.caption, fontWeight: '700', color: colors.textMuted},
});

const sizeStyles = StyleSheet.create({
  sm: {width: 36, height: 36, borderRadius: radii.pill},
  md: {width: 44, height: 44, borderRadius: radii.pill},
});
