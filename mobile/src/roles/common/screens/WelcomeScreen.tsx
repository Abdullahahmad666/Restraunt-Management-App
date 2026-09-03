import React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
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
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
