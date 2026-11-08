import React, {useEffect, useState} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

import {PrimaryButton} from './PrimaryButton';
import {TextField} from './TextField';
import type {DeletionPlan} from '../features/auth/api';
import {colors, radii, spacing, typography} from '../theme';

type Props = {
  visible: boolean;
  /** What the server says this deletion would take. Null while it loads. */
  plan: DeletionPlan | null;
  loading?: boolean;
  busy?: boolean;
  /** A server message, shown rather than swallowed - a mistyped password
   * belongs next to the box it was typed into. */
  error?: string | null;
  onConfirm: (password: string, restaurantName?: string) => void;
  onCancel: () => void;
};

/**
 * The last thing somebody sees before their account goes.
 *
 * Deliberately not a ConfirmDialog. Two things have to happen here that two
 * buttons cannot do: the person has to be told what is actually being
 * destroyed - which is different for a staff member and for the only manager
 * a restaurant has - and they have to type something, which is what stops a
 * phone left face-up on a counter being enough.
 *
 * The retention line is not a disclaimer nobody reads, it is the condition on
 * which this is allowed to work at all: Apple's guideline permits keeping data
 * you are legally obliged to keep as long as you say so, and a restaurant is
 * obliged to keep hours and pay after somebody leaves. Saying it here is also
 * just honest - the alternative is a button labelled "delete" that leaves
 * payroll rows behind without mentioning it.
 */
export function DeleteAccountDialog({
  visible,
  plan,
  loading = false,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: Props): React.JSX.Element {
  const [password, setPassword] = useState('');
  const [restaurantName, setRestaurantName] = useState('');

  // Cleared every time it opens. A password left sitting in state behind a
  // dismissed dialog is the kind of thing that ends up in a crash report.
  useEffect(() => {
    if (visible) {
      setPassword('');
      setRestaurantName('');
    }
  }, [visible]);

  const tearsDown = plan?.deletes_restaurant ?? false;
  const nameTyped = restaurantName.trim().length > 0;
  const ready =
    !busy && !loading && plan !== null && password.length > 0 && (!tearsDown || nameTyped);

  function describe(): React.ReactNode {
    if (loading || !plan) {
      return <Text style={styles.message}>Checking what this would delete...</Text>;
    }

    if (tearsDown) {
      return (
        <>
          <Text style={styles.message}>
            You are the only manager of {plan.restaurant_name}. Deleting your account also
            permanently deletes the restaurant and everything in it:
          </Text>
          <View style={styles.list}>
            <Bullet text={`${plan.restaurant_name} itself`} />
            {plan.staff_accounts > 0 ? (
              <Bullet
                text={`${plan.staff_accounts} staff ${
                  plan.staff_accounts === 1 ? 'account' : 'accounts'
                } - they will not be able to sign in`}
              />
            ) : null}
            {plan.attendance_records > 0 ? (
              <Bullet text={`${plan.attendance_records} attendance and payroll records`} />
            ) : null}
            {plan.compliance_records > 0 ? (
              <Bullet
                text={`${plan.compliance_records} food-safety records, certificates and licences`}
              />
            ) : null}
          </View>
          <Text style={styles.warning}>
            There is no way to undo this and no way to get any of it back.
          </Text>
        </>
      );
    }

    if (plan.hard_delete) {
      return (
        <Text style={styles.message}>
          Your account and everything on it will be permanently deleted. You will not be able to
          sign in again, and this cannot be undone.
        </Text>
      );
    }

    return (
      <>
        <Text style={styles.message}>
          Your account will be permanently deleted. Your email address, phone number, photo and
          password are destroyed, you will not be able to sign in again, and this cannot be undone.
        </Text>
        <Text style={styles.retention}>
          The hours you worked and the checks you recorded stay on your restaurant&apos;s record,
          under your name, marked as a former member. Your employer has to keep those by law and has
          to be able to say whose they were, so they are not yours or ours to delete.
        </Text>
      </>
    );
  }

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
          {/* Swallows taps so pressing the card does not dismiss it. */}
          <Pressable style={styles.card} onPress={() => {}}>
            {/* Scrolls because the teardown case is long, and on a small
                phone with the keyboard up there is very little left. */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.body}>
              <Text style={styles.title} testID="delete-account-title">
                Delete your account?
              </Text>

              {describe()}

              {tearsDown ? (
                <TextField
                  label={`Type "${plan?.restaurant_name}" to confirm`}
                  placeholder={plan?.restaurant_name ?? ''}
                  value={restaurantName}
                  onChangeText={setRestaurantName}
                  editable={!busy}
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="delete-restaurant-name"
                />
              ) : null}

              {!loading && plan ? (
                <TextField
                  label="Your password"
                  placeholder="Confirm it is you"
                  value={password}
                  onChangeText={setPassword}
                  editable={!busy}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="current-password"
                  returnKeyType="done"
                  testID="delete-password"
                  onSubmitEditing={() =>
                    ready && onConfirm(password, tearsDown ? restaurantName.trim() : undefined)
                  }
                />
              ) : null}

              {error ? (
                <Text style={styles.error} testID="delete-error">
                  {error}
                </Text>
              ) : null}

              <View style={styles.actions}>
                <PrimaryButton
                  label={tearsDown ? 'Delete everything' : 'Delete my account'}
                  variant="danger"
                  onPress={() => onConfirm(password, tearsDown ? restaurantName.trim() : undefined)}
                  disabled={!ready}
                  loading={busy}
                />
                <PrimaryButton label="Cancel" variant="ghost" onPress={onCancel} disabled={busy} />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Bullet({text}: {text: string}): React.JSX.Element {
  return (
    <View style={styles.bullet}>
      <Ionicons name="close-circle" size={15} color={colors.danger} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
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
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  body: {padding: spacing.lg, gap: spacing.sm},
  title: {...typography.heading, color: colors.text},
  message: {...typography.caption, color: colors.text, lineHeight: 19},
  // Quieter than the rest on purpose: it is the part that reassures rather
  // than the part that warns.
  retention: {...typography.caption, color: colors.textMuted, lineHeight: 18},
  warning: {...typography.caption, color: colors.danger, fontWeight: '700', lineHeight: 18},
  list: {gap: spacing.xs, paddingVertical: spacing.xs},
  bullet: {flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs},
  bulletText: {...typography.caption, color: colors.text, flex: 1, lineHeight: 18},
  error: {...typography.caption, color: colors.danger},
  actions: {gap: spacing.sm, marginTop: spacing.sm},
});
