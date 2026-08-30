import React from 'react';
import {ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View} from 'react-native';

import {colors, radii, spacing, typography} from '../theme';

const logo = require('../../assets/images/splash-icon.png');

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Branded replacement for Alert.alert.
 *
 * The native alert is drawn by the OS: it ignores the app's theme entirely and
 * arrives white on both platforms, which in a dark app reads as something
 * having gone wrong. It also looks different on iOS and Android, so the one
 * moment the app asks someone to confirm something is the moment it stops
 * looking like itself.
 *
 * Dismissal is deliberately not wired to a backdrop tap while `busy` - the
 * action is already in flight and closing the dialog would suggest otherwise.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: Props): React.JSX.Element {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!busy) {
          onCancel();
        }
      }}>
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          if (!busy) {
            onCancel();
          }
        }}>
        {/* Swallows taps so pressing the card itself does not dismiss it. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.markRing}>
            <Image source={logo} style={styles.mark} resizeMode="contain" />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <Pressable
              onPress={onConfirm}
              disabled={busy}
              accessibilityRole="button"
              style={({pressed}) => [
                styles.button,
                destructive ? styles.destructive : styles.primary,
                pressed && !busy && styles.pressed,
                busy && styles.disabled,
              ]}>
              {busy ? (
                <ActivityIndicator color={destructive ? colors.danger : colors.onPrimary} />
              ) : (
                <Text
                  style={[
                    styles.buttonText,
                    destructive ? styles.destructiveText : styles.primaryText,
                  ]}>
                  {confirmLabel}
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={onCancel}
              disabled={busy}
              accessibilityRole="button"
              style={({pressed}) => [
                styles.button,
                styles.cancel,
                pressed && !busy && styles.pressed,
                busy && styles.disabled,
              ]}>
              <Text style={[styles.buttonText, styles.cancelText]}>{cancelLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 9, 18, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  markRing: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  mark: {width: 36, height: 36},
  title: {...typography.heading, color: colors.text, textAlign: 'center'},
  message: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: {width: '100%', gap: spacing.sm, marginTop: spacing.md},
  button: {
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  primary: {backgroundColor: colors.primary},
  destructive: {backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger},
  cancel: {backgroundColor: 'transparent'},
  pressed: {opacity: 0.85},
  disabled: {opacity: 0.5},
  buttonText: {...typography.body, fontWeight: '700'},
  primaryText: {color: colors.onPrimary},
  destructiveText: {color: colors.danger},
  cancelText: {color: colors.textMuted},
});
