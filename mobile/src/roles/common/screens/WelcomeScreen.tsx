import React, {useState} from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {FadeIn} from '../../../components/FadeIn';
import {PrimaryButton} from '../../../components/PrimaryButton';
import {SegmentedToggle, type SegmentedOption} from '../../../components/SegmentedToggle';
import {TypeOn} from '../../../components/TypeOn';
import {colors, spacing, typography} from '../../../theme';
import type {AuthStackParamList} from '../../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;

// The same mark the splash screen shows - launch and this screen read as one
// continuous moment rather than a splash-then-app jump.
const logo = require('../../../../assets/images/splash-icon.png');

type Who = 'manager' | 'staff';

const WHO: SegmentedOption<Who>[] = [
  {value: 'manager', label: 'Manager', icon: 'briefcase-outline'},
  {value: 'staff', label: 'Staff', icon: 'people-outline'},
];

const PROMISE = 'Everything your kitchen runs on.';
const PILLARS = 'Staff. Cost. Compliance.';

/** Milliseconds per character. Fast enough that nobody waits on it, slow
 * enough to read as typing rather than as a flicker. */
const SPEED = 26;

/** The second line waits out the first, with a beat between them. Computed
 * rather than mounted late, so both lines hold their space from the start and
 * nothing below them moves when the second one begins. */
const FIRST_LINE_AT = 260;
const SECOND_LINE_AT = FIRST_LINE_AT + PROMISE.length * SPEED + 180;

/**
 * The very first screen anyone sees.
 *
 * The two people who arrive here want opposite things and cannot do each
 * other's. A manager sets up the restaurant, so they create an account from
 * nothing. A member of staff joins one that already exists and cannot sign up
 * without a code from their manager - the backend requires it, and no button
 * here can change that. Naming both audiences and showing one at a time says
 * who each route is for before anybody taps it.
 *
 * Signing in is identical either way, so it stays on both.
 *
 * Laid out as one centred column rather than a hero pinned to the top and
 * controls pinned to the bottom. That split let the mark grow to fill whatever
 * was left over, which on a tall phone meant a huge logo up top and the toggle
 * and buttons pressed against the bottom edge with nothing between them.
 * Centring keeps the group together wherever the screen ends.
 */
export function WelcomeScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [who, setWho] = useState<Who>('manager');

  return (
    <View
      style={[
        styles.screen,
        {paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg},
      ]}>
      <FadeIn style={styles.hero}>
        <Image
          source={logo}
          style={styles.logo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        {/* One sentence per line, each shrinking to fit rather than wrapping:
            "Staff. Cost. Compliance." broken across two lines loses the rhythm
            that makes it worth saying. */}
        <TypeOn
          text={PROMISE}
          style={styles.promise}
          speed={SPEED}
          delay={FIRST_LINE_AT}
          numberOfLines={1}
          adjustsFontSizeToFit
        />
        <TypeOn
          text={PILLARS}
          style={styles.pillars}
          speed={SPEED}
          delay={SECOND_LINE_AT}
          numberOfLines={1}
          adjustsFontSizeToFit
        />
      </FadeIn>

      {/* A beat behind the mark, so the eye lands on the brand and then on the
          thing it has to answer. */}
      <FadeIn delay={120} style={styles.choose}>
        <SegmentedToggle
          options={WHO}
          value={who}
          onChange={setWho}
          accessibilityLabel="Are you a manager or staff?"
        />

        <View style={styles.actions}>
          {who === 'manager' ? (
            <PrimaryButton
              label="Create an account"
              onPress={() => navigation.navigate('SetupTakeaway')}
            />
          ) : (
            <PrimaryButton
              label="Enter your invite code"
              onPress={() => navigation.navigate('Join', {})}
            />
          )}

          <PrimaryButton
            label="Sign in"
            variant="secondary"
            onPress={() => navigation.navigate('Login')}
          />
        </View>

        {/*
          Said plainly rather than discovered by trying. Staff arriving without
          a code have nothing to do here, and the sooner they know to ask their
          manager the better - an invite link often does not open the app at
          all, because a custom scheme does nothing on a phone that has not
          installed it yet, which is exactly an invite's audience.
        */}
        <Text style={styles.note}>
          {who === 'manager'
            ? 'Setting up a new restaurant? Start here - you can invite your team afterwards.'
            : 'Your manager sends you a code. You need one to set up your account.'}
        </Text>
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    // One centred group. `gap` is the only thing holding the two halves apart,
    // so neither can drift to an edge on a tall screen.
    justifyContent: 'center',
    gap: spacing.xl,
  },
  hero: {alignItems: 'center', gap: spacing.sm},
  // Sized to the mark, not to the space going spare. 96 is a shade larger than
  // the 88 every other pre-login screen uses, which is the most this one can
  // claim while still being recognisably the same header.
  logo: {width: 96, height: 96},
  // Two sizes, because they are two different jobs: the promise sets up the
  // three words that follow, and those three are what anyone repeats.
  promise: {
    // Stretched, not sized to its text: adjustsFontSizeToFit has to know how
    // much width it is fitting into, and a centred child of a centred column
    // would otherwise be measured against its own content.
    alignSelf: 'stretch',
    ...typography.body,
    fontSize: 18,
    lineHeight: 24,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  pillars: {
    alignSelf: 'stretch',
    ...typography.title,
    fontSize: 26,
    lineHeight: 34,
    color: colors.primary,
    textAlign: 'center',
  },
  choose: {gap: spacing.md},
  actions: {gap: spacing.sm},
  note: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
