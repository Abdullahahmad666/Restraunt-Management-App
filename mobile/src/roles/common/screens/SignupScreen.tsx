import React, {useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import axios from 'axios';

import {describeApiError} from '../../../api/errors';
import {tokenStorage} from '../../../api/tokenStorage';
import {AuthScreen} from '../../../components/AuthScreen';
import {BrandHeader} from '../../../components/BrandHeader';
import {Field} from '../../../components/Field';
import {FormError} from '../../../components/FormError';
import {PrimaryButton} from '../../../components/PrimaryButton';
import {RoleToggle} from '../../../components/RoleToggle';
import {fetchMe, login, register} from '../../../features/auth/api';
import {useAuthStore} from '../../../store/authStore';
import {colors, radii, spacing, typography} from '../../../theme';
import {ROLES, type Role} from '../../../types/roles';
import type {ApiErrorBody} from '../../../types/api';
import type {AuthStackParamList} from '../../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Signup'>;

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

export function SignupScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const codeRef = useRef<TextInput>(null);

  const [role, setRole] = useState<Role>(ROLES.STAFF);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const setUser = useAuthStore(state => state.setUser);

  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = role === ROLES.ADMIN;
  const tooShort = password.length > 0 && password.length < MIN_LENGTH;

  const canSubmit =
    email.trim().length > 0 &&
    password.length >= MIN_LENGTH &&
    (!isAdmin || inviteCode.trim().length > 0) &&
    !submitting;

  function changeRole(next: Role) {
    setRole(next);
    // The code is role-specific server-side, so a code typed for one role is
    // never valid for the other. Clearing it avoids a confusing rejection.
    setInviteCode('');
    setFields(current => ({...current, invite_code: ''}));
  }

  async function onSubmit() {
    if (!canSubmit) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setFields({});

    const trimmedEmail = email.trim();
    try {
      await register({
        email: trimmedEmail,
        password,
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        role,
        invite_code: inviteCode.trim() || undefined,
      });

      // Register returns the user but no tokens, so sign in straight away
      // rather than bouncing someone back to a login form they just filled in.
      const tokens = await login(trimmedEmail, password);
      await tokenStorage.setTokens(tokens);
      setUser(await fetchMe());
    } catch (err) {
      const perField = fieldErrors(err);
      setFields(perField);
      // Only show the banner when nothing landed under a specific input,
      // otherwise the same message appears twice.
      setError(Object.keys(perField).length ? null : describeApiError(err, 'Could not sign up.'));
      setSubmitting(false);
    }
  }

  return (
    <AuthScreen>
      <BrandHeader compact subtitle="Create your account" />

      <View style={styles.form}>
        <RoleToggle value={role} onChange={changeRole} disabled={submitting} />

        {isAdmin ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              Admin accounts need an invite code from someone who already administers your
              restaurant. They can generate one from the Team screen.
            </Text>
          </View>
        ) : null}

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Field
              label="First name"
              placeholder="Alex"
              autoCapitalize="words"
              autoComplete="given-name"
              returnKeyType="next"
              value={firstName}
              onChangeText={setFirstName}
              editable={!submitting}
              error={fields.first_name}
              onSubmitEditing={() => lastNameRef.current?.focus()}
            />
          </View>
          <View style={styles.rowItem}>
            <Field
              ref={lastNameRef}
              label="Last name"
              placeholder="Morgan"
              autoCapitalize="words"
              autoComplete="family-name"
              returnKeyType="next"
              value={lastName}
              onChangeText={setLastName}
              editable={!submitting}
              error={fields.last_name}
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          </View>
        </View>

        <Field
          ref={emailRef}
          label="Work email"
          placeholder="you@work.com"
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
          returnKeyType={isAdmin ? 'next' : 'go'}
          value={password}
          onChangeText={setPassword}
          editable={!submitting}
          error={fields.password ?? (tooShort ? `Use at least ${MIN_LENGTH} characters.` : null)}
          onSubmitEditing={() => (isAdmin ? codeRef.current?.focus() : onSubmit())}
        />

        <Field
          ref={codeRef}
          label={isAdmin ? 'Invite code' : 'Invite code (optional)'}
          placeholder="ABCD2345"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={16}
          returnKeyType="go"
          value={inviteCode}
          onChangeText={setInviteCode}
          editable={!submitting}
          error={fields.invite_code || null}
          hint={
            isAdmin
              ? undefined
              : 'Joins you to your restaurant. Without it an admin adds you later.'
          }
          onSubmitEditing={onSubmit}
        />

        <FormError message={error} />

        <PrimaryButton
          label="Create account"
          onPress={onSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <Pressable onPress={() => navigation.goBack()} disabled={submitting} hitSlop={8}>
          <Text style={styles.link}>Sign in</Text>
        </Pressable>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: {gap: spacing.md},
  row: {flexDirection: 'row', gap: spacing.sm},
  rowItem: {flex: 1},
  notice: {
    backgroundColor: colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  noticeText: {...typography.caption, color: colors.textMuted},
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
