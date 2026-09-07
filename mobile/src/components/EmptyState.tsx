import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {Icon, type IconName} from './Icon';
import {colors, iconSize, radii, spacing, typography} from '../theme';

type EmptyStateProps = {
  title: string;
  body?: string;
  /**
   * Optional, but worth giving: an empty screen is mostly blank space, and a
   * glyph is what tells someone at a glance that it is empty on purpose
   * rather than still loading or broken.
   */
  icon?: IconName;
  /** A way out of the empty state - usually the button that fills it. */
  action?: React.ReactNode;
};

export function EmptyState({title, body, icon, action}: EmptyStateProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      {icon ? (
        <View style={styles.iconRing}>
          <Icon name={icon} size="xl" color={colors.textMuted} />
        </View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {padding: spacing.xl, alignItems: 'center', gap: spacing.xs},
  // A ring rather than a filled badge: at this size a tinted block would read
  // as a button someone should press.
  iconRing: {
    width: iconSize.xl + spacing.lg,
    height: iconSize.xl + spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {...typography.subheading, color: colors.text, textAlign: 'center'},
  body: {...typography.caption, fontSize: 14, color: colors.textMuted, textAlign: 'center'},
  action: {marginTop: spacing.md, alignSelf: 'stretch'},
});
