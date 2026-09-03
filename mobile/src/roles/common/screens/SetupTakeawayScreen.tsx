import React, {useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import axios from 'axios';

import {describeApiError} from '../../../api/errors';
import {AuthScreen} from '../../../components/AuthScreen';
import {Field} from '../../../components/Field';
import {FormError} from '../../../components/FormError';
import {PrimaryButton} from '../../../components/PrimaryButton';
import {register} from '../../../features/auth/api';
import {colors, spacing, typography} from '../../../theme';
import {ROLES} from '../../../types/roles';
import type {ApiErrorBody} from '../../../types/api';
import type {AuthStackParamList} from '../../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'SetupTakeaway'>;

const MIN_LENGTH = 8;

/** Pull DRF's per-field messages out so they can sit under the right input. */
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
 * "Your name" is one field here, not first/last - nobody wants to fill in
 * two boxes to set up their own business. The backend still stores the two
 * separately, so it's split on the last space rather than sent whole; a
 * single name (no space) becomes the first name with an empty last name,
 * same as leaving "Last name" blank anywhere else in the app.
 */
function splitName(fullName: string): {firstName: string; lastName: string} {
  const trimmed = fullName.trim().replace(/\s+/g, ' ');
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace === -1) {
    return {firstName: trimmed, lastName: ''};
  }
  return {firstName: trimmed.slice(0, lastSpace), lastName: trimmed.slice(lastSpace + 1)};
}

/**
 * The only way an ADMIN account gets made. There is no invite code because
 * there is nobody yet who could have issued one - this call creates both the
 * account and a brand new restaurant in one step (see restaurant_name on
 * RegisterSerializer). Staff never see this screen; they arrive through an
 * invite link instead (JoinScreen).
 */
export function SetupTakeawayScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const yourNameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const [takeawayName, setTakeawayName] = useState('');
  const [yourName, setYourName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;

  const canSubmit =
    takeawayName.trim().length > 0 &&
    yourName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= MIN_LENGTH &&
    !submitting;

  async function onSubmit() {
    if (!canSubmit) {
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
        phone: phone.trim() || undefined,
        role: ROLES.ADMIN,
        restaurant_name: takeawayName.trim(),
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

  return (
    <AuthScreen>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Set up your takeaway</Text>
        <Text style={styles.subtitle}>Takes about 2 minutes. You can invite staff after.</Text>
      </View>

      <View style={styles.form}>
        <Field
          label="Takeaway name"
          placeholder="e.g. Golden Spice"
          autoCapitalize="words"
          returnKeyType="next"
          value={takeawayName}
          onChangeText={setTakeawayName}
          editable={!submitting}
          error={fields.restaurant_name}
          onSubmitEditing={() => yourNameRef.current?.focus()}
        />

        <Field
          ref={yourNameRef}
          label="Your name"
          placeholder="Full name"
          autoCapitalize="words"
          autoComplete="name"
          returnKeyType="next"
          value={yourName}
          onChangeText={setYourName}
          editable={!submitting}
          error={fields.first_name ?? fields.last_name}
          onSubmitEditing={() => phoneRef.current?.focus()}
        />

        <Field
          ref={phoneRef}
          label="Phone number"
          placeholder="+44 7700 900123"
          keyboardType="phone-pad"
          autoComplete="tel"
          returnKeyType="next"
          value={phone}
          onChangeText={setPhone}
          editable={!submitting}
          error={fields.phone}
          onSubmitEditing={() => emailRef.current?.focus()}
        />

        <Field
          ref={emailRef}
          label="Work email"
          placeholder="you@yourtakeaway.com"
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
          label="Create account"
          onPress={onSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />

        <Text style={styles.legal}>
          By continuing you agree to our <Text style={styles.legalLink}>Terms</Text> and{' '}
          <Text style={styles.legalLink}>Privacy Policy</Text>
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <Pressable onPress={() => navigation.navigate('Login')} disabled={submitting} hitSlop={8}>
          <Text style={styles.link}>Sign in</Text>
        </Pressable>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  titleBlock: {marginBottom: spacing.xl},
  title: {...typography.title, color: colors.text},
  subtitle: {...typography.caption, color: colors.textMuted, marginTop: spacing.xs},
  form: {gap: spacing.md},
  legal: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  legalLink: {color: colors.primary, fontWeight: '600'},
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
  },
  footerText: {...typography.caption, color: colors.textMuted},
  link: {...typography.caption, color: colors.primary, fontWeight: '600'},
});
