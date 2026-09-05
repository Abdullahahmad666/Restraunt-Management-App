import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

import {AuthScreen} from '../../../components/AuthScreen';
import {PrimaryButton} from '../../../components/PrimaryButton';
import {fetchMe} from '../../../features/auth/api';
import {useSignOut} from '../../../features/auth/useSignOut';
import {useAuthStore} from '../../../store/authStore';
import {colors, spacing, typography} from '../../../theme';

/**
 * Shown instead of AdminNavigator for an ADMIN whose self-registered
 * restaurant hasn't been approved yet (see restaurant_is_approved on /me/).
 * There is nothing to configure here - approval only happens in Django
 * Admin - so this screen just lets someone check again or step away.
 */
export function PendingApprovalScreen(): React.JSX.Element {
  const setUser = useAuthStore(state => state.setUser);
  const signOut = useSignOut();

  const [checking, setChecking] = useState(false);

  async function onCheckAgain() {
    setChecking(true);
    try {
      setUser(await fetchMe());
    } catch {
      // Offline or a transient error - staying on this screen is fine, the
      // user can just try again.
    } finally {
      setChecking(false);
    }
  }

  return (
    <AuthScreen>
      <View style={styles.iconWrap}>
        <Ionicons name="time-outline" size={40} color={colors.primary} />
      </View>

      <Text style={styles.title}>Your takeaway is being reviewed</Text>
      <Text style={styles.body}>
        We&apos;ve sent your details for approval. Once it&apos;s reviewed, you&apos;ll be able to
        sign in and start setting up your team - no need to do anything else in the meantime.
      </Text>

      <View style={styles.actions}>
        <PrimaryButton label="Check again" onPress={onCheckAgain} loading={checking} />
        <PrimaryButton label="Sign out" variant="secondary" onPress={signOut} disabled={checking} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
});
