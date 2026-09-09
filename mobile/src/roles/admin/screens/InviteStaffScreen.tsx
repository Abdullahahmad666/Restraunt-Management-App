import React, {useEffect, useState} from 'react';
import {Share, StyleSheet, Text, View} from 'react-native';
import * as Clipboard from 'expo-clipboard';

import {Button} from '../../../components/Button';
import {ErrorState} from '../../../components/ErrorState';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {describeApiError} from '../../../api/errors';
import {useCreateStaffInvite} from '../../../features/invites/hooks';
import {colors, radii, spacing} from '../../../theme';

/**
 * Just the code - no deep link. JoinScreen already has a "type the code by
 * hand" path (it has to: the link's custom scheme does nothing on a phone
 * without the app yet, which is most of an invite's audience, and nothing at
 * all in Expo Go), so the code alone is a complete, working invite on its
 * own rather than a fallback for when the link fails.
 */
export function InviteStaffScreen(): React.JSX.Element {
  const createInvite = useCreateStaffInvite();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    createInvite.mutate();
    // Only ever once, when the screen opens - re-running on every render
    // would mint a fresh code each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (createInvite.isPending || createInvite.isIdle) {
    return <LoadingView />;
  }

  if (createInvite.isError) {
    return (
      <ErrorState
        message={describeApiError(createInvite.error, 'Could not create an invite.')}
        onRetry={() => createInvite.mutate()}
      />
    );
  }

  const code = createInvite.data.code;
  const shareMessage = `You're invited to join the team on Invisiko. Install the app, tap "Join a team" and enter this code: ${code}`;

  async function onCopy() {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Screen>
      <Text style={styles.heading}>Invite a staff member</Text>
      <Text style={styles.hint}>
        Send this code to one new team member. They install the app, enter it on the Join screen,
        and create their own account - it can only be used once.
      </Text>

      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>Invite code</Text>
        <Text style={styles.code} selectable>
          {code}
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          title="Share"
          variant="secondary"
          onPress={() => Share.share({message: shareMessage})}
        />
        <Button title={copied ? 'Copied!' : 'Copy code'} onPress={onCopy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 22, fontWeight: '700', color: colors.text},
  hint: {fontSize: 14, color: colors.textMuted},
  codeBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: 4,
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  code: {fontSize: 32, fontWeight: '700', color: colors.primary, letterSpacing: 4},
  actions: {flexDirection: 'row', gap: spacing.sm},
});
