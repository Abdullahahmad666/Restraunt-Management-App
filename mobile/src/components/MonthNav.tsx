import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

import {PressableScale} from './PressableScale';
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
      <PressableScale onPress={onPrevious} hitSlop={10} accessibilityRole="button">
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </PressableScale>
      <Text style={styles.label}>{label}</Text>
      <PressableScale
        onPress={onNext}
        disabled={nextDisabled}
        hitSlop={10}
        accessibilityRole="button">
        <Ionicons
          name="chevron-forward"
          size={22}
          color={nextDisabled ? colors.textMuted : colors.text}
        />
      </PressableScale>
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
