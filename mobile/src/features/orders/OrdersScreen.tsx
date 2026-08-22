import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {spacing} from '../../theme';

/** Open orders and their status. */
export function OrdersScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Orders</Text>
      <Text>Open orders and their status.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, padding: spacing.lg, gap: spacing.sm},
  heading: {fontSize: 24, fontWeight: '600'},
});
