import React from 'react';
import {RefreshControl, ScrollView, StyleSheet, View, type ScrollViewProps} from 'react-native';

import {colors, spacing} from '../theme';

type ScreenProps = ScrollViewProps & {
  children: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  scroll?: boolean;
};

/** Standard screen padding/background so every screen doesn't restate it. */
export function Screen({
  children,
  onRefresh,
  refreshing = false,
  scroll = true,
  style,
  contentContainerStyle,
  ...rest
}: ScreenProps): React.JSX.Element {
  if (!scroll) {
    return <View style={[styles.plain, style]}>{children}</View>;
  }

  return (
    <ScrollView
      style={[styles.container, style]}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        ) : undefined
      }
      {...rest}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg, gap: spacing.md},
  plain: {flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md},
});
