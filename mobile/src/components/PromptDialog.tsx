import React, {useEffect, useState} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {PrimaryButton} from './PrimaryButton';
import {TextField} from './TextField';
import {colors, radii, spacing, typography} from '../theme';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  label: string;
  placeholder?: string;
  /** What the box starts with - a suggestion worth accepting, usually. */
  initialValue?: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  /** Anything else being asked for at the same time - a date, a category.
   * Inside the dialog, because a field belonging to a question has to be
   * where the question is. */
  children?: React.ReactNode;
};

/**
 * Asks for one short piece of text before doing something.
 *
 * ConfirmDialog cannot do this: its two buttons are "do it" and "do not", and
 * a question needing an answer typed into it has nowhere to put the answer.
 * Dropping a field onto the screen behind the dialog is worse than not asking
 * - the prompt is visible, the field is not, and the person is told to fill in
 * something they cannot see.
 *
 * The keyboard is the whole reason for the KeyboardAvoidingView: on a small
 * phone it covers the bottom half of the screen, which is exactly where a
 * centred dialog's buttons are.
 */
export function PromptDialog({
  visible,
  title,
  message,
  label,
  placeholder,
  initialValue = '',
  confirmLabel,
  busy = false,
  onConfirm,
  onCancel,
  children,
}: Props): React.JSX.Element {
  const [value, setValue] = useState(initialValue);

  // Reset each time it opens. A dialog that reopens holding the last answer
  // is one that silently files the wrong name against the next thing.
  useEffect(() => {
    if (visible) {
      setValue(initialValue);
    }
  }, [visible, initialValue]);

  const ready = value.trim().length > 0 && !busy;

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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (!busy) {
              onCancel();
            }
          }}>
          {/* Swallows taps so pressing the card itself does not dismiss it. */}
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}

            <TextField
              label={label}
              placeholder={placeholder}
              value={value}
              onChangeText={setValue}
              editable={!busy}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => ready && onConfirm(value.trim())}
            />

            {children}

            <View style={styles.actions}>
              <PrimaryButton
                label={confirmLabel}
                onPress={() => onConfirm(value.trim())}
                disabled={!ready}
                loading={busy}
              />
              <PrimaryButton label="Cancel" variant="ghost" onPress={onCancel} disabled={busy} />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
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
    gap: spacing.sm,
  },
  title: {...typography.heading, color: colors.text},
  message: {...typography.caption, color: colors.textMuted, lineHeight: 18},
  actions: {gap: spacing.sm, marginTop: spacing.sm},
});
