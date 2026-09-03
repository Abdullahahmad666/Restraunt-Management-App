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

  async function onCopy() {
    await Clipboard.setStringAsync(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Screen>
      <Text style={styles.heading}>Invite a staff member</Text>
      <Text style={styles.hint}>
        Send this link to one new team member. Opening it lets them create their own account and
        join your team automatically - it can only be used once.
      </Text>

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
              message: `You're invited to join the team on Invisiko. Tap to sign up: ${link}`,
            })
          }
        />
        <Button title={copied ? 'Copied!' : 'Copy link'} onPress={onCopy} />
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
  actions: {flexDirection: 'row', gap: spacing.sm},
});
