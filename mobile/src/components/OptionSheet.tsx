import React from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

import {PressableScale} from './PressableScale';
import {colors, radii, spacing, typography} from '../theme';

export type SheetOption = {
  label: string;
  hint?: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title: string;
  options: SheetOption[];
  cancelLabel?: string;
  onCancel: () => void;
};

/**
 * A short list of ways to do one thing, asked at the bottom of the screen
 * where a thumb already is.
 *
 * ConfirmDialog is the wrong shape for this and was being used for it anyway:
 * its two buttons are "do it" and "do not", so a second real choice had to go
 * in the cancel slot - which meant tapping the backdrop, or pressing back,
 * silently picked it. Dismissing this one picks nothing.
 */
export function OptionSheet({
  visible,
  title,
  options,
  cancelLabel = 'Cancel',
  onCancel,
}: Props): React.JSX.Element {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityRole="button">
        {/* Swallows taps so pressing the sheet itself does not dismiss it. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{title}</Text>

          <View style={styles.options}>
            {options.map(option => (
              <PressableScale
                key={option.label}
                onPress={option.onPress}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                style={styles.option}>
                <View style={styles.iconWrap}>
                  <Ionicons name={option.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  {option.hint ? <Text style={styles.optionHint}>{option.hint}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </PressableScale>
            ))}
          </View>

          <PressableScale onPress={onCancel} accessibilityRole="button" style={styles.cancel}>
            <Text style={styles.cancelLabel}>{cancelLabel}</Text>
          </PressableScale>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {flex: 1, backgroundColor: 'rgba(3, 9, 18, 0.82)', justifyContent: 'flex-end'},
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    padding: spacing.lg,
    // Clears the home indicator on a gesture-navigation phone without
    // reaching for insets inside a modal, where they are unreliable.
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  title: {...typography.heading, color: colors.text},
  options: {gap: spacing.sm},
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {flex: 1, gap: 2},
  optionLabel: {...typography.body, fontWeight: '600', color: colors.text},
  optionHint: {...typography.caption, color: colors.textMuted},
  cancel: {alignItems: 'center', paddingVertical: spacing.sm},
  cancelLabel: {...typography.body, fontWeight: '600', color: colors.textMuted},
});
