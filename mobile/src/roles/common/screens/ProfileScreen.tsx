import React, {useState} from 'react';
import {Alert, ScrollView, StyleSheet, Text, View} from 'react-native';

import {BrandHeader} from '../../../components/BrandHeader';
import {PrimaryButton} from '../../../components/PrimaryButton';
import {useAuthStore} from '../../../store/authStore';
import {colors, radii, spacing, typography} from '../../../theme';
import {ROLES} from '../../../types/roles';

function initialsOf(first: string, last: string, email: string): string {
  const fromName = `${first.trim()[0] ?? ''}${last.trim()[0] ?? ''}`.trim();
  return (fromName || email.trim()[0] || '?').toUpperCase();
}

function Row({label, value}: {label: string; value: string}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable>
        {value}
      </Text>
    </View>
  );
}

export function ProfileScreen(): React.JSX.Element {
  const user = useAuthStore(state => state.user);
  const signOut = useAuthStore(state => state.signOut);
  const [signingOut, setSigningOut] = useState(false);

  function confirmSignOut() {
    // A misplaced tap on a shared kiosk should not end someone's shift screen,
    // so this asks first rather than acting immediately.
    Alert.alert('Sign out?', 'You will need your email and password to sign back in.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          // No cleanup afterwards: signOut flips the navigator and this screen
          // unmounts, so setting state here would warn.
          await signOut();
        },
      },
    ]);
  }

  // The navigator only mounts this behind an authenticated session, so a null
  // user means the session was torn down mid-render - sign-out, or a refresh
  // that failed. Render nothing rather than crash; the navigator is already
  // swapping this screen out.
  if (!user) {
    return <View style={styles.screen} />;
  }

  const fullName = `${user.first_name} ${user.last_name}`.trim();
  const isAdmin = user.role === ROLES.ADMIN;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {initialsOf(user.first_name, user.last_name, user.email)}
          </Text>
        </View>

        <Text style={styles.name}>{fullName || user.email}</Text>

        <View style={[styles.badge, isAdmin ? styles.badgeAdmin : styles.badgeStaff]}>
          <Text style={[styles.badgeText, isAdmin && styles.badgeTextAdmin]}>
            {isAdmin ? 'Admin' : 'Staff'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        <Row label="Email" value={user.email} />
        {fullName ? <Row label="Name" value={fullName} /> : null}
        {user.phone ? <Row label="Phone" value={user.phone} /> : null}
        <Row label="Role" value={isAdmin ? 'Admin' : 'Staff'} />
        <Row label="Restaurant" value={user.restaurant ? 'Assigned' : 'Not assigned yet'} />
      </View>

      {!user.restaurant ? (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            Your account is not attached to a restaurant yet, so your screens will be empty. Ask an
            admin for an invite code, or to add you to the team.
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton
          label="Sign out"
          variant="danger"
          onPress={confirmSignOut}
          loading={signingOut}
        />
      </View>

      <BrandHeader compact subtitle="" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg, gap: spacing.lg},
  identity: {alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md},
  avatar: {
    width: 88,
    height: 88,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {...typography.title, color: colors.primary},
  name: {...typography.heading, color: colors.text},
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  badgeStaff: {borderColor: colors.border, backgroundColor: colors.surface},
  badgeAdmin: {borderColor: colors.primary, backgroundColor: colors.primary},
  badgeText: {...typography.caption, fontWeight: '700', color: colors.textMuted},
  badgeTextAdmin: {color: colors.onPrimary},
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  rowLabel: {...typography.body, color: colors.textMuted},
  rowValue: {...typography.body, color: colors.text, flexShrink: 1, textAlign: 'right'},
  warning: {
    backgroundColor: colors.surfaceRaised,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  warningText: {...typography.caption, color: colors.textMuted},
  actions: {marginTop: spacing.sm},
});
