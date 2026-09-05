import React, {useEffect, useState} from 'react';
import {Share, StyleSheet, Text, View} from 'react-native';
import * as Clipboard from 'expo-clipboard';

import {Button} from '../../../components/Button';
import {ErrorState} from '../../../components/ErrorState';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {describeApiError} from '../../../api/errors';
import {useCreateStaffInvite} from '../../../features/invites/hooks';
import {colors, spacing} from '../../../theme';

/**
 * Nothing but the link: no roster, no forms. A fresh invite is generated the
 * moment this screen opens - one code per visit, matching how it's shared
 * (to one person at a time, see InviteCode.used_by being a one-to-one).
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

  const link = createInvite.data.invite_link;
  const code = createInvite.data.code;

  /**
   * The link uses a custom scheme, so tapping it does nothing on a phone that
   * does not have the app yet - which is most of the audience for an invite.
   * Sending the code alongside it means that is an inconvenience rather than a
   * dead end: install the app, tap Join, type the code.
   */
  const shareMessage = [
    "You're invited to join the team on Invisiko.",
    '',
    `Already have the app? Tap this: ${link}`,
    '',
    `Otherwise install Invisiko, tap "Join a team" and enter this code: ${code}`,
  ].join('\n');

  async function onCopy() {
    await Clipboard.setStringAsync(shareMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Screen>
      <Text style={styles.heading}>Invite a staff member</Text>
      <Text style={styles.hint}>
        Send this to one new team member. They create their own account and join your team
        automatically - it can only be used once.
      </Text>

      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>Invite code</Text>
        <Text style={styles.code} selectable>
          {code}
        </Text>
        <Text style={styles.codeHint}>
          Works even if the link does not - they can type this on the Join screen.
        </Text>
      </View>

      <View style={styles.linkBox}>
        <Text style={styles.linkText} selectable>
          {link}
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          title="Share"
          variant="secondary"
          onPress={() =>
            Share.share({
              message: shareMessage,
            })
          }
        />
        <Button title={copied ? 'Copied!' : 'Copy'} onPress={onCopy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 22, fontWeight: '700', color: colors.text},
  hint: {fontSize: 14, color: colors.textMuted},
  linkBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
  },
  linkText: {fontSize: 14, color: colors.text},
  codeBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    padding: spacing.md,
    gap: 4,
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  code: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 4,
  },
  codeHint: {fontSize: 12, color: colors.textMuted, textAlign: 'center'},
  actions: {flexDirection: 'row', gap: spacing.sm},
});
