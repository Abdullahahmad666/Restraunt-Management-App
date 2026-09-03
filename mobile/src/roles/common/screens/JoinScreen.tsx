import React, {useRef, useState} from 'react';
import {StyleSheet, Text, TextInput, View} from 'react-native';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import axios from 'axios';

import {describeApiError} from '../../../api/errors';
import {AuthScreen} from '../../../components/AuthScreen';
import {BrandHeader} from '../../../components/BrandHeader';
import {Field} from '../../../components/Field';
import {FormError} from '../../../components/FormError';
import {LoadingView} from '../../../components/LoadingView';
import {PrimaryButton} from '../../../components/PrimaryButton';
import {register} from '../../../features/auth/api';
import {useInviteInfo} from '../../../features/auth/hooks';
import {colors, spacing, typography} from '../../../theme';
import {ROLES} from '../../../types/roles';
import type {ApiErrorBody} from '../../../types/api';
import type {AuthStackParamList} from '../../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Join'>;
type Params = RouteProp<AuthStackParamList, 'Join'>;

const MIN_LENGTH = 8;

function splitName(fullName: string): {firstName: string; lastName: string} {
  const trimmed = fullName.trim().replace(/\s+/g, ' ');
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace === -1) {
    return {firstName: trimmed, lastName: ''};
  }
  return {firstName: trimmed.slice(0, lastSpace), lastName: trimmed.slice(lastSpace + 1)};
}

function fieldErrors(error: unknown): Record<string, string> {
  if (!axios.isAxiosError(error) || !error.response) {
    return {};
  }
  const body = error.response.data as ApiErrorBody | undefined;
  if (!body) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (Array.isArray(value) && typeof value[0] === 'string') {
      out[key] = value[0];
    }
  }
  return out;
}

/**
 * Reached only by tapping an admin's shared invite link - there is no way to
 * navigate here from inside the app, on purpose. Staff never type a code or
 * pick a restaurant; both travel invisibly in the link, and this screen's
 * whole job is to turn that into "Your name, email, password" and nothing
 * else.
 */
export function JoinScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Params>();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const code = params?.code;
  const invite = useInviteInfo(code);

  const [yourName, setYourName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const canSubmit =
    yourName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= MIN_LENGTH &&
    !submitting;

  async function onSubmit() {
    if (!canSubmit || !code) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setFields({});

    const trimmedEmail = email.trim();
    const {firstName, lastName} = splitName(yourName);

    try {
      await register({
        email: trimmedEmail,
        password,
        first_name: firstName,
        last_name: lastName || undefined,
        role: ROLES.STAFF,
        invite_code: code,
      });

      // The backend won't issue tokens until the email is verified, so the
      // password travels to VerifyEmail rather than signing in here. Reset
      // submitting regardless - this screen stays mounted underneath and
      // would otherwise show a stuck spinner if someone navigates back.
      setSubmitting(false);
      navigation.navigate('VerifyEmail', {email: trimmedEmail, password});
    } catch (err) {
      const perField = fieldErrors(err);
      setFields(perField);
      setError(Object.keys(perField).length ? null : describeApiError(err, 'Could not sign up.'));
      setSubmitting(false);
    }
  }

  // Opened directly, or the link got mangled somewhere along the way - not
  // "invalid code" (the server hasn't been asked yet), just nothing to ask it.
  if (!code) {
    return (
      <AuthScreen>
        <BrandHeader compact subtitle="Invite link needed" />
        <Text style={styles.intro}>
          You need an invite link from your manager to join their team. Ask them to send you one
          from the Team screen.
        </Text>
        <PrimaryButton label="Back to sign in" onPress={() => navigation.navigate('Login')} />
      </AuthScreen>
    );
  }

  if (invite.isLoading) {
    return <LoadingView />;
  }

  if (invite.error || !invite.data || !invite.data.is_usable) {
    return (
      <AuthScreen>
        <BrandHeader compact subtitle="This invite isn't valid" />
        <Text style={styles.intro}>
          {invite.data && !invite.data.is_usable
            ? `This invite from ${invite.data.invited_by_name} has already been used or has expired.`
            : "This invite link couldn't be found. It may have expired."}{' '}
          Ask your manager to send you a new one.
        </Text>
        <PrimaryButton label="Back to sign in" onPress={() => navigation.navigate('Login')} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Join {invite.data.restaurant_name}</Text>
        <Text style={styles.subtitle}>Invited by {invite.data.invited_by_name}</Text>
      </View>

      <View style={styles.form}>
        <Field
          label="Your name"
          placeholder="Full name"
          autoCapitalize="words"
          autoComplete="name"
          returnKeyType="next"
          value={yourName}
          onChangeText={setYourName}
          editable={!submitting}
          error={fields.first_name ?? fields.last_name}
          onSubmitEditing={() => emailRef.current?.focus()}
        />

        <Field
          ref={emailRef}
          label="Email"
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          keyboardType="email-address"
          returnKeyType="next"
          value={email}
          onChangeText={setEmail}
          editable={!submitting}
          error={fields.email}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />

        <Field
          ref={passwordRef}
          label="Password"
          placeholder="At least 8 characters"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          value={password}
          onChangeText={setPassword}
          editable={!submitting}
          error={fields.password ?? (tooShort ? `Use at least ${MIN_LENGTH} characters.` : null)}
          onSubmitEditing={onSubmit}
        />

        <FormError message={error} />

        <PrimaryButton
          label="Join the team"
          onPress={onSubmit}
          disabled={!canSubmit}
          loading={submitting}
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
  intro: {...typography.body, color: colors.textMuted, textAlign: 'center'},
});
