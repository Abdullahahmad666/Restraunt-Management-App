import React, {useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {describeApiError} from '../../../api/errors';
import {tokenStorage} from '../../../api/tokenStorage';
import {AuthScreen} from '../../../components/AuthScreen';
import {BrandHeader} from '../../../components/BrandHeader';
import {Field} from '../../../components/Field';
import {FormError} from '../../../components/FormError';
import {PrimaryButton} from '../../../components/PrimaryButton';
import {fetchMe, login} from '../../../features/auth/api';
import {useAuthStore} from '../../../store/authStore';
import {colors, spacing, typography} from '../../../theme';
import type {AuthStackParamList} from '../../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export function LoginScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const setUser = useAuthStore(state => state.setUser);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  async function onSubmit() {
    if (!canSubmit) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const tokens = await login(email.trim(), password);
      await tokenStorage.setTokens(tokens);
      // Only now does the session become real - setUser flips the navigator.
      setUser(await fetchMe());
    } catch (err) {
      // Say what actually failed. "Check your password" when the phone cannot
      // reach the server sends whoever is debugging it to the wrong place.
      setError(describeApiError(err, 'Could not sign in.'));
      setSubmitting(false);
    }
    // Deliberately no `finally`: on success this screen unmounts as the
    // navigator switches, and clearing state on an unmounted screen warns.
  }

  return (
    <AuthScreen>
      <BrandHeader />

      <View style={styles.form}>
        <Field
          label="Email"
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
          onSubmitEditing={() => passwordRef.current?.focus()}
        />

        <Field
          ref={passwordRef}
          label="Password"
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          value={password}
          onChangeText={setPassword}
          editable={!submitting}
          onSubmitEditing={onSubmit}
        />

        <Pressable
          onPress={() => navigation.navigate('ForgotPassword')}
          disabled={submitting}
          hitSlop={8}
          style={styles.forgotWrap}>
          <Text style={styles.link}>Forgot password?</Text>
        </Pressable>

        <FormError message={error} />

        <PrimaryButton
          label="Sign in"
          onPress={onSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>New here?</Text>
        <Pressable onPress={() => navigation.navigate('Signup')} disabled={submitting} hitSlop={8}>
          <Text style={styles.link}>Create an account</Text>
        </Pressable>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: {gap: spacing.md},
  forgotWrap: {alignSelf: 'flex-end'},
  link: {...typography.caption, color: colors.primary, fontWeight: '600'},
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
  },
  footerText: {...typography.caption, color: colors.textMuted},
});
