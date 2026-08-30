import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, spacing} from '../theme';

type EmptyStateProps = {
  title: string;
  body?: string;
};

export function EmptyState({title, body}: EmptyStateProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {padding: spacing.xl, alignItems: 'center', gap: spacing.xs},
  title: {fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center'},
  body: {fontSize: 14, color: colors.textMuted, textAlign: 'center'},
});
