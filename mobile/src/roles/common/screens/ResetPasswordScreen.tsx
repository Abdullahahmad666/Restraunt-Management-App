import React, {useMemo, useRef, useState} from 'react';
import {StyleSheet, Text, TextInput, View} from 'react-native';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {describeApiError} from '../../../api/errors';
import {AuthScreen} from '../../../components/AuthScreen';
import {BrandHeader} from '../../../components/BrandHeader';
import {Field} from '../../../components/Field';
import {FormError} from '../../../components/FormError';
import {PrimaryButton} from '../../../components/PrimaryButton';
import {confirmPasswordReset} from '../../../features/auth/api';
import {colors, spacing, typography} from '../../../theme';
import type {AuthStackParamList} from '../../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'ResetPassword'>;
type Params = RouteProp<AuthStackParamList, 'ResetPassword'>;

/** Matches the backend's validators. Checked here only to fail fast and kindly. */
const MIN_LENGTH = 8;

export function ResetPasswordScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Params>();
  const confirmRef = useRef<TextInput>(null);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const uid = params?.uid;
  const token = params?.token;
  const hasLink = Boolean(uid && token);

  // Mismatch is worth saying immediately rather than after a round trip - the
  // server cannot tell us this, since it only ever receives one of the two.
  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < MIN_LENGTH;

  const canSubmit = useMemo(
    () => hasLink && password.length >= MIN_LENGTH && password === confirm && !submitting,
    [hasLink, password, confirm, submitting],
  );

  async function onSubmit() {
    if (!canSubmit || !uid || !token) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await confirmPasswordReset({uid, token, newPassword: password});
      setDone(true);
    } catch (err) {
      // An expired or already-used link lands here, which is the common case
      // once someone requests a second email and opens the first one.
      setError(describeApiError(err, 'Could not reset your password.'));
    } finally {
      setSubmitting(false);
    }
  }

  // Opened directly rather than from the emailed link.
  if (!hasLink) {
    return (
      <AuthScreen>
        <BrandHeader compact subtitle="Link needed" />
        <Text style={styles.intro}>
          Open the reset link from your email to choose a new password. Links expire after a few
          hours.
        </Text>
        <View style={styles.actions}>
          <PrimaryButton
            label="Request a new link"
            onPress={() => navigation.replace('ForgotPassword')}
          />
          <PrimaryButton
            label="Back to sign in"
            variant="secondary"
            onPress={() => navigation.popTo('Login')}
          />
        </View>
      </AuthScreen>
    );
  }

  if (done) {
    return (
      <AuthScreen>
        <BrandHeader compact subtitle="Password updated" />
        <Text style={styles.intro}>
          Your password has been changed. You can sign in with it now.
        </Text>
        <View style={styles.actions}>
          <PrimaryButton label="Sign in" onPress={() => navigation.popTo('Login')} />
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <BrandHeader compact subtitle="Choose a new password" />

      <View style={styles.form}>
        <Field
          label="New password"
          placeholder="At least 8 characters"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          autoFocus
          value={password}
          onChangeText={setPassword}
          editable={!submitting}
          error={tooShort ? `Use at least ${MIN_LENGTH} characters.` : null}
          hint="Avoid something you use elsewhere."
          onSubmitEditing={() => confirmRef.current?.focus()}
        />

        <Field
          ref={confirmRef}
          label="Confirm new password"
          placeholder="Type it again"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          value={confirm}
          onChangeText={setConfirm}
          editable={!submitting}
          error={mismatch ? 'These do not match.' : null}
          onSubmitEditing={onSubmit}
        />

        <FormError message={error} />

        <PrimaryButton
          label="Set new password"
          onPress={onSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: {gap: spacing.md},
  intro: {...typography.body, color: colors.textMuted, textAlign: 'center'},
  actions: {gap: spacing.md, marginTop: spacing.xl},
});
