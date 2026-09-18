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
import type {AdminStackParamList} from '../../../navigation/types';
import {colors, spacing} from '../../../theme';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function routineProgress(
  fridges: FridgeUnit[],
  readings: TemperatureReading[],
  itemCount: number,
  completions: ChecklistCompletion[],
  itemIds: Set<string>,
): {done: number; total: number} {
  const doneItems = completions.filter(c => itemIds.has(c.checklist_item)).length;
  return {done: readings.length + doneItems, total: fridges.length + itemCount};
}

/** Today's checks across the restaurant, then the tiles to configure them -
 * fridges/freezers and the two checklists. A manager sees and completes a
 * routine exactly like staff do (same RoutineScreen); this screen's own
 * job is the overview plus the "Manage" section staff never see. */
export function ComplianceDashboardScreen(): React.JSX.Element {
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
        message={describeApiError(anyError, 'Could not load compliance.')}
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
        <FadeIn delay={160} style={styles.tileWrap}>
          <GridTile
            icon="list-outline"
            label="Other Checklists"
            subtitle="Daily, weekly, monthly"
            onPress={() => navigation.navigate('OtherChecklists')}
          />
        </FadeIn>
      </View>

      <Text style={styles.heading}>Manage</Text>
      <View style={styles.grid}>
        <FadeIn delay={160} style={styles.tileWrap}>
          <GridTile
            icon="snow-outline"
            label="Fridges & freezers"
            subtitle={`${fridgeList.length} registered`}
            onPress={() => navigation.navigate('ManageFridges')}
          />
        </FadeIn>
        <FadeIn delay={210} style={styles.tileWrap}>
          <GridTile
            icon="list-outline"
            label="Opening checklist"
            subtitle={`${openingItemIds.size} items`}
            onPress={() => navigation.navigate('ManageChecklist', {routine: 'OPENING'})}
          />
        </FadeIn>
        <FadeIn delay={260} style={styles.tileWrap}>
          <GridTile
            icon="list-outline"
            label="Closing checklist"
            subtitle={`${closingItemIds.size} items`}
            onPress={() => navigation.navigate('ManageChecklist', {routine: 'CLOSING'})}
          />
        </FadeIn>
        <FadeIn delay={310} style={styles.tileWrap}>
          <GridTile
            icon="today-outline"
            label="Daily checklists"
            subtitle="e.g. Toilet cleaning"
            onPress={() => navigation.navigate('ManageChecklistTemplates', {frequency: 'DAILY'})}
          />
        </FadeIn>
        <FadeIn delay={360} style={styles.tileWrap}>
          <GridTile
            icon="calendar-outline"
            label="Weekly checklists"
            subtitle="e.g. Team meeting"
            onPress={() => navigation.navigate('ManageChecklistTemplates', {frequency: 'WEEKLY'})}
          />
        </FadeIn>
        <FadeIn delay={410} style={styles.tileWrap}>
          <GridTile
            icon="calendar-clear-outline"
            label="Monthly checklists"
            subtitle="e.g. Deep clean"
            onPress={() => navigation.navigate('ManageChecklistTemplates', {frequency: 'MONTHLY'})}
          />
        </FadeIn>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.sm},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between'},
  tileWrap: {width: '48%'},
});
