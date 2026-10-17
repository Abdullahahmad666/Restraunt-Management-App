import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

import {PrimaryButton} from './PrimaryButton';
import {colors, spacing, typography} from '../theme';

type ErrorStateProps = {
  message: string;
  /** May return a promise - a refetch does. The button then spins until it
   * settles, because a retry over a dead connection takes the full request
   * timeout to fail, and a button that does nothing visible for fifteen
   * seconds reads as a button that does not work. */
  onRetry?: () => void | Promise<unknown>;
};

/**
 * What a screen shows when it could not load.
 *
 * Deliberately quiet. Most of what lands here is a connection that dropped on
 * the way between tables, which is not an error anybody needs explaining - it
 * needs one button. The message says what happened in a sentence, and the
 * detail that would help a developer goes to the console instead of to
 * somebody holding a phone in a kitchen.
 */
export function ErrorState({message, onRetry}: ErrorStateProps): React.JSX.Element {
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    if (!onRetry) {
      return;
    }
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      // Reached on a failed retry too, which is the case that matters: the
      // same screen is still here and its button has to be pressable again.
      setRetrying(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="cloud-offline-outline" size={26} color={colors.textMuted} />
      </View>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <View style={styles.action}>
          <PrimaryButton
            label={retrying ? 'Trying…' : 'Try again'}
            variant="secondary"
            onPress={retry}
            loading={retrying}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Not danger red. A dropped connection is ordinary, and a screen of red text
  // makes somebody think they have broken something.
  message: {...typography.body, color: colors.textMuted, textAlign: 'center', maxWidth: 320},
  action: {alignSelf: 'stretch', maxWidth: 280, width: '100%'},
});
