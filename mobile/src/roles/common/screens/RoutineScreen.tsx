import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';

import {ErrorState} from '../../../components/ErrorState';
import {FadeIn} from '../../../components/FadeIn';
import {GridTile} from '../../../components/GridTile';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {describeApiError} from '../../../api/errors';
import {
  useChecklistCompletions,
  useChecklistItems,
  useFridgeUnits,
  useTemperatureReadings,
} from '../../../features/compliance/hooks';
import {ROUTINE_LABELS} from '../../../features/compliance/types';
import type {ComplianceStackParamList} from '../../../navigation/types';
import {colors, spacing} from '../../../theme';

type Nav = NativeStackNavigationProp<ComplianceStackParamList>;
type Route = RouteProp<ComplianceStackParamList, 'Routine'>;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The opening or closing routine's own hub - two tiles, matching the SFBB
 * "Main Routine" shape: fridge/freezer temperatures, and the checklist for
 * this end of the day. Each tile's subtitle is a live "X of Y done" count,
 * so a manager or staff member sees at a glance whether the routine is
 * actually finished without opening either screen.
 */
export function RoutineScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const {
    params: {routine},
  } = useRoute<Route>();
  const date = todayIso();

  const fridges = useFridgeUnits();
  const readings = useTemperatureReadings({date, routine});
  const items = useChecklistItems(routine);
  const completions = useChecklistCompletions(date);

  if (fridges.isLoading || readings.isLoading || items.isLoading || completions.isLoading) {
    return <LoadingView />;
  }
  if (fridges.error || readings.error || items.error || completions.error) {
    return (
      <ErrorState
        message={describeApiError(
          fridges.error ?? readings.error ?? items.error ?? completions.error,
          'Could not load this routine.',
        )}
        onRetry={() => {
          fridges.refetch();
          readings.refetch();
          items.refetch();
          completions.refetch();
        }}
      />
    );
  }

  const fridgeCount = fridges.data?.results.length ?? 0;
  const readingCount = readings.data?.results.length ?? 0;

  const routineItemIds = new Set((items.data?.results ?? []).map(item => item.id));
  const itemCount = routineItemIds.size;
  const doneCount = (completions.data?.results ?? []).filter(completion =>
    routineItemIds.has(completion.checklist_item),
  ).length;

  return (
    <Screen>
      <Text style={styles.heading}>{ROUTINE_LABELS[routine]} routine</Text>

      <View style={styles.grid}>
        <FadeIn delay={60} style={styles.tileWrap}>
          <GridTile
            icon="thermometer-outline"
            label="Fridge/Freezer Temperatures"
            subtitle={
              fridgeCount === 0 ? 'None set up yet' : `${readingCount} of ${fridgeCount} done`
            }
            onPress={() => navigation.navigate('FridgeTemperatures', {routine})}
          />
        </FadeIn>
        <FadeIn delay={110} style={styles.tileWrap}>
          <GridTile
            icon="checkbox-outline"
            label={`${ROUTINE_LABELS[routine]} Checklist`}
            subtitle={itemCount === 0 ? 'None set up yet' : `${doneCount} of ${itemCount} done`}
            onPress={() => navigation.navigate('Checklist', {routine})}
          />
        </FadeIn>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 20, fontWeight: '700', color: colors.text},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between'},
  tileWrap: {width: '48%'},
});
