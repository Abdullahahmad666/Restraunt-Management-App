import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {PrimaryButton} from '../../../components/PrimaryButton';
import {colors, spacing, typography} from '../../../theme';
import type {AuthStackParamList} from '../../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;

// The same mark the splash screen shows, at hero size - launch and this
// screen read as one continuous moment rather than a splash-then-app jump.
const logo = require('../../../../assets/images/splash-icon.png');

/**
 * The very first screen anyone sees. Its only job is "Create an account" or
 * "Sign in" - nothing here is read or filled in, so it carries no form and
 * needs none of AuthScreen's keyboard handling.
 */
export function WelcomeScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();

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

        <View style={styles.actions}>
          <PrimaryButton
            label="Create an account"
            onPress={() => navigation.navigate('SetupTakeaway')}
          />
          <PrimaryButton
            label="Sign in"
            variant="secondary"
            onPress={() => navigation.navigate('Login')}
          />

          {/*
            "Create an account" opens the owner form, which is the wrong one
            for most people who tap it - staff outnumber owners heavily. Both
            screens carry AccountTypeToggle so a wrong turn is one tap to fix,
            and this shortcut means someone holding a code from their manager
            never has to take the wrong turn at all.
          */}
          <Pressable
            onPress={() => navigation.navigate('Join', {})}
            hitSlop={8}
            style={styles.inviteLink}>
            <Text style={styles.inviteText}>Joining a team? Use your invite code</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inviteLink: {alignSelf: 'center', paddingVertical: spacing.sm},
  inviteText: {fontSize: 14, fontWeight: '600', color: colors.primary},
  screen: {flex: 1, backgroundColor: colors.background},
  hero: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  logo: {width: 160, height: 160},
  bottom: {padding: spacing.lg, paddingBottom: spacing.xl},
  headline: {
    ...typography.title,
    fontSize: 32,
    lineHeight: 38,
    color: colors.text,
    marginBottom: spacing.xl,
  },
  headlineAccent: {color: colors.primary},
  actions: {gap: spacing.sm},
});
