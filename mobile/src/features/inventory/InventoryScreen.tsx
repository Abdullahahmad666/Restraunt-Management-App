import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {spacing} from '../../theme';

/** Stock levels and low-stock alerts. */
export function InventoryScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Inventory</Text>
      <Text>Stock levels and low-stock alerts.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, padding: spacing.lg, gap: spacing.sm},
  heading: {fontSize: 24, fontWeight: '600'},
});
