import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

import {PressableScale} from './PressableScale';
import {colors, radii, spacing} from '../theme';

type Props = {
  /** What is picked, or what the absence of a pick is called. */
  title: string;
  /** One short line. Short because it shares the row with the action - a
   * sentence here is a sentence with its end cut off. */
  hint?: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  /** `pending` is the state somebody still has to do something about, and the
   * only one that spends a colour. */
  tone?: 'pending' | 'done';
  actionLabel: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/**
 * A row that says what is currently chosen and opens a picker for changing it.
 *
 * Three things on the invoice review screen are the same job - which stock
 * item a line is, who supplied the invoice, where it was delivered - and each
 * had grown its own answer, two of them a wall of chips. One row, one sheet,
 * and the state visible without reading: an amber edge while something is
 * unset, a neutral one once it is not.
 */
export function PickerRow({
  title,
  hint,
  icon,
  tone = 'done',
  actionLabel,
  onPress,
  disabled = false,
  accessibilityLabel,
}: Props): React.JSX.Element {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${title}. ${actionLabel}`}
      style={[
        styles.row,
        tone === 'pending' ? styles.pending : styles.done,
        disabled && styles.locked,
      ]}>
      <Ionicons
        name={icon}
        size={20}
        color={tone === 'pending' ? colors.warning : colors.success}
      />
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {hint ? (
          <Text style={styles.hint} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
      {disabled ? null : (
        <View style={styles.action}>
          <Text style={styles.actionLabel}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    backgroundColor: colors.surfaceRaised,
  },
  pending: {borderColor: colors.warning},
  done: {borderColor: colors.border},
  locked: {opacity: 0.6},
  text: {flex: 1, gap: 1},
  title: {fontSize: 15, fontWeight: '600', color: colors.text},
  hint: {fontSize: 12, color: colors.textMuted},
  action: {flexDirection: 'row', alignItems: 'center', gap: 2},
  actionLabel: {fontSize: 13, fontWeight: '700', color: colors.primary},
});
