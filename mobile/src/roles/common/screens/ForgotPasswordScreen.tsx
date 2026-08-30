import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {describeApiError} from '../../../api/errors';
import {AuthScreen} from '../../../components/AuthScreen';
import {BrandHeader} from '../../../components/BrandHeader';
import {Field} from '../../../components/Field';
import {FormError} from '../../../components/FormError';
import {PrimaryButton} from '../../../components/PrimaryButton';
import {requestPasswordReset} from '../../../features/auth/api';
import {colors, radii, spacing, typography} from '../../../theme';
import type {AuthStackParamList} from '../../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const canSubmit = email.trim().length > 0 && !submitting;

  async function onSubmit() {
    if (!canSubmit) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(describeApiError(err, 'Could not send the reset email.'));
    } finally {
      setSubmitting(false);
    }
  }

  // The server answers the same for a registered and an unregistered address,
  // so this screen must too. Saying "no account found" here would undo that and
  // turn the app into a way to find out who works somewhere.
  if (sent) {
    return (
      <AuthScreen>
        <BrandHeader compact subtitle="Check your email" />

        <View style={styles.confirmation}>
          <Text style={styles.confirmationText}>
            If <Text style={styles.email}>{email.trim()}</Text> has an account, a reset link is on
            its way.
          </Text>
          <Text style={styles.note}>
            The link expires in a few hours and can only be used once. It may take a minute to
            arrive - check your spam folder before asking for another.
          </Text>
        </View>

        <View style={styles.actions}>
          <PrimaryButton label="Back to sign in" onPress={() => navigation.popTo('Login')} />
          <PrimaryButton
            label="Use a different email"
            variant="secondary"
            onPress={() => {
              setSent(false);
              setEmail('');
            }}
          />
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <BrandHeader compact subtitle="Forgotten your password?" />

      <View style={styles.form}>
        <Text style={styles.intro}>
          Enter the email you sign in with and we will send you a link to choose a new password.
        </Text>

        <Field
          label="Email"
          placeholder="you@work.com"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          keyboardType="email-address"
          returnKeyType="go"
          autoFocus
          value={email}
          onChangeText={setEmail}
          editable={!submitting}
          onSubmitEditing={onSubmit}
        />

        <FormError message={error} />

        <PrimaryButton
          label="Send reset link"
          onPress={onSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />
        <PrimaryButton
          label="Back to sign in"
          variant="secondary"
          onPress={() => navigation.goBack()}
          disabled={submitting}
        />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: {gap: spacing.md},
  intro: {...typography.body, color: colors.textMuted},
  confirmation: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  confirmationText: {...typography.body, color: colors.text},
  email: {color: colors.primary, fontWeight: '700'},
  note: {...typography.caption, color: colors.textMuted},
  actions: {gap: spacing.md, marginTop: spacing.lg},
});
