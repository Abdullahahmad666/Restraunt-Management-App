import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {SegmentedControl, type Segment} from './SegmentedControl';
import {colors, spacing, typography} from '../theme';

/**
 * Which of the two account-creation routes someone is on.
 *
 * Not a role claim. `join` and `setup` are genuinely different forms hitting
 * the register endpoint with different fields - an invite code against
 * someone else's restaurant, or a takeaway name that creates a new one - and
 * the backend decides the role from those, never from anything picked here.
 */
export type AccountType = 'join' | 'setup';

const SEGMENTS: readonly Segment<AccountType>[] = [
  {value: 'join', label: 'Join a team', icon: 'people'},
  {value: 'setup', label: 'Set up a takeaway', icon: 'storefront'},
];

/** Keyed rather than a list so the caption lookup cannot come back empty. */
const CAPTIONS: Record<AccountType, string> = {
  join: 'You were sent an invite code by your manager.',
  setup: "You own or manage the business, and you'll invite the team.",
};

type Props = {
  value: AccountType;
  onChange: (value: AccountType) => void;
  disabled?: boolean;
};

/**
 * Sits above the sign-up forms so the two routes in are one choice rather
 * than a button and a footnote.
 *
 * Staff and owners need entirely different things at sign-up - a code versus
 * a business name - but they arrive at "create an account" with the same
 * intent, and Welcome used to send everyone to the owner form with the staff
 * route as small print underneath. Anyone who missed it landed on "Set up
 * your takeaway" and had no reason to think the app had a place for them.
 *
 * The caption below the track is what makes this legible: "Join a team" is
 * only obvious once you know an invite code is involved.
 */
export function AccountTypeToggle({value, onChange, disabled = false}: Props): React.JSX.Element {
  return (
    <View style={styles.root}>
      <SegmentedControl
        segments={SEGMENTS}
        value={value}
        onChange={onChange}
        disabled={disabled}
        accessibilityLabel="What kind of account are you creating?"
      />
      <Text style={styles.caption}>{CAPTIONS[value]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Owns the gap below itself: AuthScreen sets no gap between children, so
  // otherwise the caption sits flush against whatever heading follows.
  root: {marginBottom: spacing.lg},
  caption: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
});
