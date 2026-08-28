import React, {useState} from 'react';
import {ActivityIndicator, Button, StyleSheet, Text, TextInput, View} from 'react-native';

import {describeApiError} from '../../../api/errors';
import {tokenStorage} from '../../../api/tokenStorage';
import {useAuthStore} from '../../../store/authStore';
import {colors, spacing} from '../../../theme';
import {fetchMe, login} from '../../../features/auth/api';

export function LoginScreen(): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const setUser = useAuthStore(state => state.setUser);

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
    <View style={styles.container}>
      <Text style={styles.heading}>Sign in</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {submitting ? (
        <ActivityIndicator />
      ) : (
        <Button title="Sign in" onPress={onSubmit} disabled={!email || !password} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md},
  heading: {fontSize: 28, fontWeight: '600', marginBottom: spacing.md},
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 16,
  },
  error: {color: colors.danger},
});
