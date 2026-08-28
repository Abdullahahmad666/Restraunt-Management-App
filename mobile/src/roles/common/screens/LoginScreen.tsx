import React, {useState} from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {describeApiError} from '../../../api/errors';
import {tokenStorage} from '../../../api/tokenStorage';
import {useAuthStore} from '../../../store/authStore';
import {colors, radii, spacing, TAGLINE, typography} from '../../../theme';
import {fetchMe, login} from '../../../features/auth/api';

// Same mark the splash shows, so the hand-off reads as one continuous screen.
const logo = require('../../../../assets/images/splash-icon.png');

export function LoginScreen(): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const setUser = useAuthStore(state => state.setUser);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const tokens = await login(email.trim(), password);
      await tokenStorage.setTokens(tokens);
      setUser(await fetchMe());
    } catch (err) {
      // Say what actually failed. "Check your password" when the phone cannot
      // reach the server sends whoever is debugging it to the wrong place.
      setError(describeApiError(err, 'Could not sign in.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          <Text style={styles.wordmark}>Invisiko</Text>
          <Text style={styles.tagline}>{TAGLINE}</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@work.com"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
            value={email}
            onChangeText={setEmail}
            editable={!submitting}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            returnKeyType="go"
            value={password}
            onChangeText={setPassword}
            editable={!submitting}
            onSubmitEditing={() => canSubmit && onSubmit()}
          />

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            style={({pressed}) => [
              styles.button,
              pressed && styles.buttonPressed,
              !canSubmit && styles.buttonDisabled,
            ]}>
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: colors.background},
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  brand: {alignItems: 'center', marginBottom: spacing.xxl},
  logo: {width: 88, height: 88},
  wordmark: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.md,
    letterSpacing: 0.5,
  },
  tagline: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  form: {gap: spacing.sm},
  label: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.text,
  },
  errorBox: {
    backgroundColor: colors.surfaceRaised,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  errorText: {...typography.caption, color: colors.danger},
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 52,
  },
  buttonPressed: {backgroundColor: colors.primaryPressed},
  buttonDisabled: {backgroundColor: colors.primaryDisabled},
  buttonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
