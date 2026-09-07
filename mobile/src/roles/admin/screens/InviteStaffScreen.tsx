import React, {useCallback, useEffect, useState} from 'react';
import {Pressable, Share, StyleSheet, Text, View} from 'react-native';
import * as Clipboard from 'expo-clipboard';

import {Button} from '../../../components/Button';
import {ErrorState} from '../../../components/ErrorState';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {describeApiError} from '../../../api/errors';
import {useCreateStaffInvite} from '../../../features/invites/hooks';
import {colors, radii, spacing} from '../../../theme';
import type {InviteCode} from '../../../features/invites/types';

/** Long enough to read as deliberate feedback, short enough that the control
 * is back to its normal label before anyone reaches for it again. */
const CONFIRMATION_MS = 2000;

/**
 * One code, one new team member. A fresh invite is minted when the screen
 * opens - InviteCode.used_by is a one-to-one, so a code is spent by the first
 * person who redeems it and sharing the same one twice would only disappoint
 * the second.
 *
 * There is no link here. `invisiko://join?code=..` does nothing on a phone
 * that does not have the app installed - the only kind of phone an invite is
 * ever sent to - so it was always the code doing the work.
 */
export function InviteStaffScreen(): React.JSX.Element {
  const createInvite = useCreateStaffInvite();
  const [confirmation, setConfirmation] = useState<'code' | 'message' | null>(null);

  // Held here rather than read off the mutation, so asking for a second code
  // leaves the first one on screen until its replacement arrives instead of
  // dropping the whole page back to a spinner.
  const [invite, setInvite] = useState<InviteCode | null>(null);

  const generate = useCallback(() => {
    setConfirmation(null);
    createInvite.mutate(undefined, {onSuccess: setInvite});
    // createInvite is rebuilt every render; depending on it would make this
    // callback - and the mount effect below - fire on every render, minting a
    // code each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(generate, [generate]);

  // Timers outlive the screen, so clear the pending one rather than let it
  // set state on something that has been unmounted.
  useEffect(() => {
    if (!confirmation) {
      return;
    }
    const timer = setTimeout(() => setConfirmation(null), CONFIRMATION_MS);
    return () => clearTimeout(timer);
  }, [confirmation]);

  if (!invite) {
    return createInvite.isError ? (
      <ErrorState
        message={describeApiError(createInvite.error, 'Could not create an invite.')}
        onRetry={generate}
      />
    ) : (
      <LoadingView />
    );
  }

  const code = invite.code;
  const expiresOn = new Date(invite.expires_at).toLocaleDateString(undefined, {
    dateStyle: 'medium',
  });

  /** Sent whole over WhatsApp or SMS: what the code is, and what to do with
   * it. Someone who has never heard of Invisiko needs that middle step. */
  const shareMessage = [
    "You've been invited to join the team on Invisiko.",
    '',
    `Your invite code is ${code}`,
    '',
    'Install Invisiko, choose "Join a team" and enter the code.',
  ].join('\n');

  async function copy(text: string, which: 'code' | 'message') {
    await Clipboard.setStringAsync(text);
    setConfirmation(which);
  }

  return (
    <Screen>
      <Text style={styles.heading}>Invite a staff member</Text>
      <Text style={styles.hint}>
        Send this code to one new team member. They enter it when creating their account and join
        your team automatically. It works once, and expires on {expiresOn}.
      </Text>

      {/*
        The code itself is the button. Reading eight characters off a screen
        and retyping them into WhatsApp is exactly the sort of thing that gets
        one character wrong, so tapping what you are looking at copies it.
      */}
      <Pressable
        onPress={() => copy(code, 'code')}
        accessibilityRole="button"
        accessibilityLabel={`Invite code ${code.split('').join(' ')}. Tap to copy.`}
        style={({pressed}) => [styles.codeCard, pressed && styles.pressed]}>
        <Text style={styles.codeLabel}>Invite code</Text>
        <Text style={styles.code} selectable>
          {code}
        </Text>
        <Text style={[styles.tapHint, confirmation === 'code' && styles.tapHintDone]}>
          {confirmation === 'code' ? 'Copied to clipboard' : 'Tap to copy'}
        </Text>
      </Pressable>

      {/* Button sizes itself to its label, so each is given an equal half of
          the row rather than the pair huddling in the middle. */}
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            title={confirmation === 'message' ? 'Copied!' : 'Copy message'}
            variant="secondary"
            onPress={() => copy(shareMessage, 'message')}
          />
        </View>
        <View style={styles.action}>
          <Button title="Share code" onPress={() => Share.share({message: shareMessage})} />
        </View>
      </View>

      {/* Inviting two people in a row is common and each needs their own code.
          Without this the only way to get a second is to leave and come back. */}
      <Pressable
        onPress={generate}
        disabled={createInvite.isPending}
        hitSlop={8}
        style={({pressed}) => [styles.newCode, pressed && styles.pressed]}>
        <Text style={[styles.newCodeText, createInvite.isPending && styles.newCodeTextBusy]}>
          {createInvite.isPending ? 'Generating…' : 'Need another? Generate a new code'}
        </Text>
      </Pressable>

      {/* A failed retry must not look like nothing happened - the code above
          is still the old one, and still valid. */}
      {createInvite.isError ? (
        <Text style={styles.error}>
          {describeApiError(createInvite.error, 'Could not create a new code.')}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 22, fontWeight: '700', color: colors.text},
  hint: {fontSize: 14, color: colors.textMuted, lineHeight: 20},
  pressed: {opacity: 0.8},
  codeCard: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  code: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.primary,
    // Wide tracking so no two characters run together for someone copying
    // them down by hand.
    letterSpacing: 6,
    // letterSpacing pads the right of the last character too, which throws
    // the block off-centre by that much without this.
    marginLeft: 6,
  },
  tapHint: {fontSize: 12, color: colors.textMuted},
  tapHintDone: {color: colors.success, fontWeight: '600'},
  actions: {flexDirection: 'row', gap: spacing.sm},
  action: {flex: 1},
  newCode: {alignSelf: 'center', paddingVertical: spacing.sm},
  newCodeText: {fontSize: 14, fontWeight: '600', color: colors.primary},
  newCodeTextBusy: {color: colors.textMuted},
  error: {fontSize: 13, color: colors.danger, textAlign: 'center'},
});
