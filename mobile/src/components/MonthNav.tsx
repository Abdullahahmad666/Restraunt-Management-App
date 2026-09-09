import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

import {colors, spacing, typography} from '../theme';

export function MonthNav({
  label,
  onPrevious,
  onNext,
  nextDisabled = false,
}: {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Pressable onPress={onPrevious} hitSlop={10} accessibilityRole="button">
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={onNext} disabled={nextDisabled} hitSlop={10} accessibilityRole="button">
        <Ionicons
          name="chevron-forward"
          size={22}
          color={nextDisabled ? colors.textMuted : colors.text}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  label: {...typography.body, fontWeight: '700', color: colors.text},
});
