import React, {useState} from 'react';
import {ActivityIndicator, Button, StyleSheet, Text, TextInput, View} from 'react-native';

import {tokenStorage} from '../../api/tokenStorage';
import {useAuthStore} from '../../store/authStore';
import {colors, spacing} from '../../theme';
import {fetchMe, login} from './authApi';

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
    } catch {
      setError('Could not sign in. Check your email and password.');
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
