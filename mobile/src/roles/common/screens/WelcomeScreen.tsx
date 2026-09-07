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
            Staff invited by a manager land here when the invite link did not
            open the app - a custom scheme does nothing without the app
            installed, which is exactly the person an invite is aimed at.
            They can type the code that came with it instead.
          */}
          <Pressable
            onPress={() => navigation.navigate('Join', {})}
            hitSlop={8}
            style={styles.inviteLink}>
            <Text style={styles.inviteText}>Have an invite code?</Text>
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
