import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import axios from 'axios';

import {describeApiError} from '../../../api/errors';
import {tokenStorage} from '../../../api/tokenStorage';
import {AuthScreen} from '../../../components/AuthScreen';
import {Field} from '../../../components/Field';
import {FormError} from '../../../components/FormError';
import {PrimaryButton} from '../../../components/PrimaryButton';
import {fetchMe, login, verifyEmail} from '../../../features/auth/api';
import {useAuthStore} from '../../../store/authStore';
import {colors, spacing, typography} from '../../../theme';
import type {ApiErrorBody} from '../../../types/api';
import type {AuthStackParamList} from '../../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'VerifyEmail'>;
type Params = RouteProp<AuthStackParamList, 'VerifyEmail'>;

const OTP_LENGTH = 6;

function describeVerifyError(error: unknown): string {
  if (axios.isAxiosError(error) && error.response) {
    const body = error.response.data as ApiErrorBody | undefined;
    const detail = body?.non_field_errors ?? body?.detail ?? body?.otp;
    if (Array.isArray(detail) && typeof detail[0] === 'string') {
      return detail[0];
    }
    if (typeof detail === 'string') {
      return detail;
    }
  }
  return describeApiError(error, 'Could not verify that code.');
}

/**
 * Reached right after SetupTakeaway or Join register a new account - the
 * backend won't issue tokens for an unverified email, so signing in has to
 * wait for this. Once the code checks out, it signs in with the password
 * carried over in route params rather than sending someone back to a login
 * form they just filled in.
 */
export function VerifyEmailScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Params>();
  const setUser = useAuthStore(state => state.setUser);

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = otp.trim().length === OTP_LENGTH && !submitting;

  async function onSubmit() {
    if (!canSubmit) {
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      await verifyEmail(params.email, otp.trim());
      const tokens = await login(params.email, params.password);
      await tokenStorage.setTokens(tokens);
      setUser(await fetchMe());
    } catch (err) {
      setError(describeVerifyError(err));
      setSubmitting(false);
    }
  }

  return (
    <AuthScreen>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to {params.email}. Enter it below to verify your account.
        </Text>
      </View>

      <View style={styles.form}>
        <Field
          label="Verification code"
          placeholder="123456"
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          autoFocus
          value={otp}
          onChangeText={text => setOtp(text.replace(/[^0-9]/g, ''))}
          editable={!submitting}
          onSubmitEditing={onSubmit}
        />

        <FormError message={error} />

        <PrimaryButton
          label="Verify"
          onPress={onSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />

        <PrimaryButton
          label="Back to sign in"
          variant="secondary"
          onPress={() => navigation.navigate('Login')}
          disabled={submitting}
        />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  titleBlock: {marginBottom: spacing.xl},
  title: {...typography.title, color: colors.text},
  subtitle: {...typography.caption, color: colors.textMuted, marginTop: spacing.xs},
  form: {gap: spacing.md},
});
