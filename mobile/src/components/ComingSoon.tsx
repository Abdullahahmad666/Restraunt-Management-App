import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, spacing} from '../theme';

type ComingSoonProps = {
  title: string;
  body: string;
};

/** For screens whose backend app has no models or endpoints yet (compliance, equipment). */
export function ComingSoon({title, body}: ComingSoonProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.badge}>Coming soon</Text>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, padding: spacing.lg, gap: spacing.sm, justifyContent: 'center'},
  badge: {
    alignSelf: 'flex-start',
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heading: {fontSize: 24, fontWeight: '600', color: colors.text},
  body: {fontSize: 15, color: colors.textMuted},
});
