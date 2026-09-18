import React, {useEffect, useState} from 'react';
import {Share, StyleSheet, Text, View} from 'react-native';
import * as Clipboard from 'expo-clipboard';

import {Button} from '../../../components/Button';
import {ErrorState} from '../../../components/ErrorState';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {describeApiError} from '../../../api/errors';
import {useCreateStaffInvite, useInviteCodes} from '../../../features/invites/hooks';
import {colors, radii, spacing} from '../../../theme';

/**
 * One standing invite code the whole team shares - not a one-time ticket.
 * It keeps working for every new joiner until a manager asks for a new one
 * here, which is also the only thing that stops the old one working (see
 * AdminInviteCodeViewSet.perform_create on the backend). So this screen
 * shows the restaurant's current active code if one already exists, rather
 * than minting a fresh (and so immediately-replacing) one on every visit.
 *
 * No deep link shown - JoinScreen already has a "type the code by hand"
 * path (it has to: the link's custom scheme does nothing on a phone
 * without the app yet, which is most of an invite's audience, and nothing
 * at all in Expo Go), so the code alone is a complete, working invite.
 */
export function InviteStaffScreen(): React.JSX.Element {
  const codes = useInviteCodes();
  const createInvite = useCreateStaffInvite();
  const [copied, setCopied] = useState(false);
  const [confirmingNew, setConfirmingNew] = useState(false);

  const activeCode = codes.data?.results.find(c => c.role === 'STAFF' && c.is_usable);
  const hasNoCode = codes.isSuccess && !activeCode;

  useEffect(() => {
    // Only when the restaurant has never had one - not on every visit,
    // which would silently replace (and so invalidate) an existing code
    // nobody asked to retire yet.
    if (hasNoCode) {
      createInvite.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNoCode]);

  if (codes.isLoading || (hasNoCode && (createInvite.isPending || createInvite.isIdle))) {
    return <LoadingView />;
  }

  if (codes.isError) {
    return (
      <ErrorState
        message={describeApiError(codes.error, 'Could not load the invite code.')}
        onRetry={() => codes.refetch()}
      />
    );
  }

  if (createInvite.isError && !activeCode) {
    return (
      <ErrorState
        message={describeApiError(createInvite.error, 'Could not create an invite.')}
        onRetry={() => createInvite.mutate()}
      />
    );
  }

  // createInvite.data wins once populated - freshest after a "Generate new
  // code" tap, ahead of the list query's background refetch landing.
  const code = (createInvite.data ?? activeCode)?.code;
  if (!code) {
    return <LoadingView />;
  }

  const shareMessage = `You're invited to join the team on Invisiko. Install the app, tap "Join a team" and enter this code: ${code}`;

  async function onCopy() {
    await Clipboard.setStringAsync(code as string);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function onGenerateNew() {
    await createInvite.mutateAsync();
    setConfirmingNew(false);
  }

  return (
    <Screen>
      <Text style={styles.heading}>Invite your team</Text>
      <Text style={styles.hint}>
        Share this code with everyone you want to join. Anyone can enter it on the Join screen to
        create their own account - it keeps working for the whole team until you generate a new one
        below.
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

      {confirmingNew ? (
        <View style={styles.confirmBox}>
          <Text style={styles.warning}>
            This stops the code above from working for anyone who hasn't joined yet. Continue?
          </Text>
          <View style={styles.actions}>
            <Button title="Cancel" variant="secondary" onPress={() => setConfirmingNew(false)} />
            <Button
              title="Yes, generate new code"
              onPress={onGenerateNew}
              loading={createInvite.isPending}
            />
          </View>
        </View>
      ) : (
        <Button
          title="Generate new code"
          variant="secondary"
          onPress={() => setConfirmingNew(true)}
        />
      )}
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
  confirmBox: {gap: spacing.sm},
  warning: {fontSize: 12, color: colors.warning},
});
