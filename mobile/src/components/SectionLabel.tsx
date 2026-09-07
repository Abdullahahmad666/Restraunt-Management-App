import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, spacing, typography} from '../theme';

type SectionLabelProps = {
  label: string;
  /** A count, a total, a date range - whatever the section is showing. */
  value?: string;
};

/**
 * Names a group of rows or cards partway down a screen.
 *
 * Screens were using a second, smaller heading for this - 14pt bold in the
 * muted colour, declared separately on three of them - which put section
 * labels and screen titles in the same visual family and left the hierarchy
 * flat. Upper-case and widely tracked reads as a label rather than as a
 * smaller title, so the screen has an obvious first line again.
 */
export function SectionLabel({label, value}: SectionLabelProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {value ? <Text style={styles.value}>{value}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    // Lines the label up with card and row content rather than the screen
    // edge, so it reads as belonging to what follows it.
    paddingHorizontal: spacing.xs,
    marginTop: spacing.sm,
  },
  label: {...typography.overline, color: colors.textMuted, textTransform: 'uppercase'},
  value: {...typography.caption, fontWeight: '600', color: colors.textMuted},
});
