import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

import {colors, iconSize, radii} from '../theme';

/**
 * Every glyph in the app comes from Ionicons.
 *
 * Not because it is the best set, but because it is one set. @expo/vector-icons
 * ships a dozen families and mixing them is instantly visible - stroke weights
 * and corner radii differ enough that two icons side by side look like they
 * came from different apps. This alias is the enforcement: screens import
 * `Icon`, never a family directly, so the choice is made once.
 */
export type IconName = React.ComponentProps<typeof Ionicons>['name'];

type IconProps = {
  name: IconName;
  /** Defaults to `md` - inline with body text. */
  size?: keyof typeof iconSize;
  color?: string;
};

export function Icon({name, size = 'md', color = colors.text}: IconProps): React.JSX.Element {
  return <Ionicons name={name} size={iconSize[size]} color={color} />;
}

type Tone = 'primary' | 'neutral' | 'success' | 'warning' | 'danger';

type IconBadgeProps = {
  name: IconName;
  tone?: Tone;
  /** `sm` for a list row, `md` for a screen header. */
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
};

/**
 * A glyph in a rounded, tinted square.
 *
 * This is the single detail doing most of the work in making a list of rows
 * look built rather than assembled. A bare icon beside a label leaves the
 * text and the glyph fighting for the same optical line; a badge gives every
 * row an identical anchor at the left, so labels of different lengths still
 * line up as a column and the eye has one edge to run down.
 *
 * The tint is the accent at low opacity rather than solid, so a screen full
 * of these does not spend all its amber before reaching the button that
 * actually matters.
 */
export function IconBadge({
  name,
  tone = 'primary',
  size = 'md',
  style,
}: IconBadgeProps): React.JSX.Element {
  return (
    <View style={[styles.badge, sizeStyles[size], toneStyles[tone], style]}>
      <Icon name={name} size={size === 'sm' ? 'md' : 'lg'} color={toneColors[tone]} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {alignItems: 'center', justifyContent: 'center'},
});

const sizeStyles = StyleSheet.create({
  // A squircle rather than a circle: circles read as avatars, and these sit
  // in the same rows as actual avatars on the staff screens.
  sm: {width: 36, height: 36, borderRadius: radii.md + 2},
  md: {width: 44, height: 44, borderRadius: radii.lg - 2},
});

const toneStyles = StyleSheet.create({
  primary: {backgroundColor: colors.primarySoft},
  neutral: {backgroundColor: colors.surfaceRaised},
  success: {backgroundColor: 'rgba(61, 214, 140, 0.14)'},
  warning: {backgroundColor: 'rgba(251, 191, 36, 0.14)'},
  danger: {backgroundColor: 'rgba(255, 107, 107, 0.14)'},
});

const toneColors: Record<Tone, string> = {
  primary: colors.primary,
  neutral: colors.textMuted,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
};
