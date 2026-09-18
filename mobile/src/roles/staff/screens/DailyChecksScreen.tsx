import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

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
import type {
  ChecklistCompletion,
  ComplianceRoutine,
  FridgeUnit,
  TemperatureReading,
} from '../../../features/compliance/types';
import type {StaffStackParamList} from '../../../navigation/types';
import {colors, spacing} from '../../../theme';

type Nav = NativeStackNavigationProp<StaffStackParamList>;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Fridges + this routine's checklist, combined into one "X of Y done"
 * count for the routine's tile subtitle. */
function routineProgress(
  fridges: FridgeUnit[],
  readings: TemperatureReading[],
  itemCount: number,
  completions: ChecklistCompletion[],
  itemIds: Set<string>,
): {done: number; total: number} {
  const doneReadings = readings.length;
  const doneItems = completions.filter(c => itemIds.has(c.checklist_item)).length;
  return {done: doneReadings + doneItems, total: fridges.length + itemCount};
}

/** The staff "Checks" tab: today's opening and closing routines, each a
 * single tile into RoutineScreen's fridge-temps + checklist hub. */
export function DailyChecksScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const date = todayIso();

  const fridges = useFridgeUnits();
  const openingItems = useChecklistItems('OPENING');
  const closingItems = useChecklistItems('CLOSING');
  const openingReadings = useTemperatureReadings({date, routine: 'OPENING'});
  const closingReadings = useTemperatureReadings({date, routine: 'CLOSING'});
  const completions = useChecklistCompletions(date);

  const loading =
    fridges.isLoading ||
    openingItems.isLoading ||
    closingItems.isLoading ||
    openingReadings.isLoading ||
    closingReadings.isLoading ||
    completions.isLoading;
  const anyError =
    fridges.error ||
    openingItems.error ||
    closingItems.error ||
    openingReadings.error ||
    closingReadings.error ||
    completions.error;

  if (loading) {
    return <LoadingView />;
  }
  if (anyError) {
    return (
      <ErrorState
        message={describeApiError(anyError, 'Could not load today’s checks.')}
        onRetry={() => {
          fridges.refetch();
          openingItems.refetch();
          closingItems.refetch();
          openingReadings.refetch();
          closingReadings.refetch();
          completions.refetch();
        }}
      />
    );
  }

  const fridgeList = fridges.data?.results ?? [];
  const completionList = completions.data?.results ?? [];
  const openingItemIds = new Set((openingItems.data?.results ?? []).map(i => i.id));
  const closingItemIds = new Set((closingItems.data?.results ?? []).map(i => i.id));

  const opening = routineProgress(
    fridgeList,
    openingReadings.data?.results ?? [],
    openingItemIds.size,
    completionList,
    openingItemIds,
  );
  const closing = routineProgress(
    fridgeList,
    closingReadings.data?.results ?? [],
    closingItemIds.size,
    completionList,
    closingItemIds,
  );

  function subtitleFor(progress: {done: number; total: number}): string {
    return progress.total === 0
      ? 'Nothing set up yet'
      : `${progress.done} of ${progress.total} done`;
  }

  function goTo(routine: ComplianceRoutine) {
    navigation.navigate('Routine', {routine});
  }

  return (
    <Screen>
      <Text style={styles.heading}>Today's checks</Text>

      <View style={styles.grid}>
        <FadeIn delay={60} style={styles.tileWrap}>
          <GridTile
            icon="sunny-outline"
            label="Opening Routine"
            subtitle={subtitleFor(opening)}
            onPress={() => goTo('OPENING')}
          />
        </FadeIn>
        <FadeIn delay={110} style={styles.tileWrap}>
          <GridTile
            icon="moon-outline"
            label="Closing Routine"
            subtitle={subtitleFor(closing)}
            onPress={() => goTo('CLOSING')}
          />
        </FadeIn>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 22, fontWeight: '700', color: colors.text},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between'},
  tileWrap: {width: '48%'},
});
