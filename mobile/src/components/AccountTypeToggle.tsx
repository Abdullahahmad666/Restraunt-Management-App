import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

import {colors, radii, spacing} from '../theme';

/**
 * Which of the two account-creation routes someone is on.
 *
 * Not a role claim. `join` and `setup` are genuinely different forms hitting
 * the register endpoint with different fields - an invite code against
 * someone else's restaurant, or a takeaway name that creates a new one - and
 * the backend decides the role from those, never from anything picked here.
 */
export type AccountType = 'join' | 'setup';

type Option = {
  value: AccountType;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  caption: string;
};

/** Keyed rather than a list so the caption lookup cannot come back empty. */
const OPTIONS: Record<AccountType, Option> = {
  join: {
    value: 'join',
    label: 'Join a team',
    icon: 'people-outline',
    caption: 'You were sent an invite code by your manager.',
  },
  setup: {
    value: 'setup',
    label: 'Set up a takeaway',
    icon: 'storefront-outline',
    caption: "You own or manage the business, and you'll invite the team.",
  },
};

const ORDER: readonly AccountType[] = ['join', 'setup'];

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
      <View style={styles.track} accessibilityRole="tablist">
        {ORDER.map(key => {
          const option = OPTIONS[key];
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              disabled={disabled}
              accessibilityRole="tab"
              accessibilityState={{selected: active, disabled}}
              style={({pressed}) => [
                styles.segment,
                active && styles.segmentActive,
                pressed && !active && styles.segmentPressed,
              ]}>
              <Ionicons
                name={option.icon}
                size={16}
                color={active ? colors.onPrimary : colors.textMuted}
              />
              <Text
                numberOfLines={1}
                style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.caption}>{OPTIONS[value].caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Owns the gap below itself: AuthScreen sets no gap between children, so
  // otherwise the caption sits flush against whatever heading follows.
  root: {marginBottom: spacing.lg},
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    // 40 keeps the whole control near a comfortable tap target without the
    // bulk of two stacked buttons, which is what this replaces.
    height: 40,
    borderRadius: radii.pill,
  },
  segmentActive: {backgroundColor: colors.primary},
  segmentPressed: {backgroundColor: colors.surfaceRaised},
  label: {fontSize: 13, fontWeight: '600'},
  labelActive: {color: colors.onPrimary},
  labelInactive: {color: colors.textMuted},
  caption: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
});
