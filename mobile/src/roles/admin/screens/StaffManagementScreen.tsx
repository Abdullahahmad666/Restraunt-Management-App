import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, spacing, typography} from '../../../theme';

/** Admin-only: invite staff, assign roles, deactivate accounts. */
export function StaffManagementScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Staff</Text>
      <Text style={styles.body}>Invite staff, assign roles and deactivate accounts.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  heading: {...typography.heading, color: colors.text},
  body: {...typography.body, color: colors.textMuted},
});
