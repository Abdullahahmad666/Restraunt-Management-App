import React, {useState} from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {PrimaryButton} from '../../../components/PrimaryButton';
import {SegmentedToggle, type SegmentedOption} from '../../../components/SegmentedToggle';
import {colors, spacing, typography} from '../../../theme';
import type {AuthStackParamList} from '../../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;

// The same mark the splash screen shows, at hero size - launch and this
// screen read as one continuous moment rather than a splash-then-app jump.
const logo = require('../../../../assets/images/splash-icon.png');

type Who = 'manager' | 'staff';

const WHO: SegmentedOption<Who>[] = [
  {value: 'manager', label: 'Manager', icon: 'briefcase-outline'},
  {value: 'staff', label: 'Staff', icon: 'people-outline'},
];

/**
 * The very first screen anyone sees.
 *
 * The two people who arrive here want opposite things and cannot do each
 * other's. A manager sets up the restaurant, so they create an account from
 * nothing. A member of staff joins one that already exists and cannot sign up
 * without a code from their manager - the backend requires it, and no button
 * here can change that.
 *
 * That used to be expressed as two prominent buttons for the manager and a
 * small text link for everyone else, which put the larger audience on the
 * least visible control and offered them "Create an account" first - a path
 * that would take them to a form for setting up a restaurant they do not own.
 * Naming both audiences and showing one at a time says who each route is for
 * before anybody taps it.
 *
 * Signing in is identical either way, so it stays on both.
 */
export function WelcomeScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const [who, setWho] = useState<Who>('manager');

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Image
          source={logo}
          style={styles.logo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>

      <View style={styles.bottom}>
        <Text style={styles.headline}>
          Everything your kitchen runs on.{'\n'}
          <Text style={styles.headlineAccent}>Staff. Cost. Compliance.</Text>
        </Text>

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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.background},
  hero: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  logo: {width: 160, height: 160},
  bottom: {padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md},
  headline: {
    ...typography.title,
    fontSize: 32,
    lineHeight: 38,
    color: colors.text,
  },
  headlineAccent: {color: colors.primary},
  actions: {gap: spacing.sm},
  note: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
