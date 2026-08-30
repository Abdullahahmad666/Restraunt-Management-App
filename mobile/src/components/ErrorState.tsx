import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, spacing} from '../theme';
import {Button} from './Button';

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
};

export function ErrorState({message, onRetry}: ErrorStateProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {padding: spacing.lg, gap: spacing.md, alignItems: 'center'},
  message: {color: colors.danger, textAlign: 'center', fontSize: 15},
});
