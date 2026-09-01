import React from 'react';
import {StatusBar} from 'react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {RootNavigator} from './navigation/RootNavigator';
import {colors} from './theme';

/**
 * Hold the native splash up until we know whether there is a session.
 *
 * Called at module scope, before React renders, because the splash hides on
 * first paint otherwise - which is what produced the old white flash followed
 * by a spinner. RootNavigator hides it once the session check settles, so the
 * splash goes straight to either the login screen or the app.
 *
 * Rejection is ignored on purpose: it only happens when the splash is already
 * gone, and failing to start the app over that would be absurd.
 */
SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * One QueryClient for the whole app. Created outside the component so a
 * re-render never throws the cache away.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        {/* Light glyphs: every screen sits on the brand navy. */}
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <RootNavigator />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
