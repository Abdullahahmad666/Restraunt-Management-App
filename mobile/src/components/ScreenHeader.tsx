import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {IconBadge, type IconName} from './Icon';
import {colors, spacing, typography} from '../theme';

type ScreenHeaderProps = {
  title: string;
  /** One line on what the screen is for, or what to do next. */
  subtitle?: string;
  /** Names the screen at a glance, and gives the block a left anchor. */
  icon?: IconName;
  /** Sits opposite the title - a Button, a Badge, an icon action. */
  action?: React.ReactNode;
};

/**
 * How every screen opens.
 *
 * Nine screens used to declare their own `heading` style, landing on 18, 20,
 * 22, 24 and 26pt across two weights, some with a subtitle and some without.
 * Individually each was fine; together they meant no two screens started the
 * same way, which is most of what made the app feel like separate pages
 * bolted together rather than one product.
 *
 * The optional icon is what makes it read as deliberate rather than just big
 * text: a screen announces its subject before the title is even read.
 */
export function ScreenHeader({
  title,
  subtitle,
  icon,
  action,
}: ScreenHeaderProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {icon ? <IconBadge name={icon} /> : null}
        <View style={styles.text}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {marginBottom: spacing.xs},
  row: {flexDirection: 'row', alignItems: 'center', gap: spacing.md},
  // Takes the slack so the action stays pinned right and a long title wraps
  // rather than pushing it off the screen.
  text: {flex: 1, gap: 2},
  title: {...typography.heading, color: colors.text},
  subtitle: {...typography.caption, color: colors.textMuted},
  // Sized by its content, and never squeezed by a long title.
  action: {flexShrink: 0},
});
