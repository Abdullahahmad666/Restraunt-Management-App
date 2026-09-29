import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {FadeIn} from '../../../components/FadeIn';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {SegmentedToggle, type SegmentedOption} from '../../../components/SegmentedToggle';
import {describeApiError} from '../../../api/errors';
import {useFridgeUnits, useTemperatureReadingHistory} from '../../../features/compliance/hooks';
import {ROUTINE_LABELS} from '../../../features/compliance/types';
import type {ComplianceRoutine, TemperatureReading} from '../../../features/compliance/types';
import {colors} from '../../../theme';
import {formatDateTime} from '../../../utils/format';

/** Days, held as strings because that is what the toggle compares on. The one
 * place it matters reads it back with Number(). */
type RangeDays = '7' | '14' | '30';

const RANGE_OPTIONS: SegmentedOption<RangeDays>[] = [
  {value: '7', label: '7 days'},
  {value: '14', label: '14 days'},
  {value: '30', label: '30 days'},
];

/** 'ALL' rather than undefined, for the same reason the attendance filters use
 * it: the toggle needs a value behind every option. */
type RoutineFilter = ComplianceRoutine | 'ALL';

const ROUTINE_FILTERS: SegmentedOption<RoutineFilter>[] = [
  {value: 'ALL', label: 'All'},
  {value: 'OPENING', label: 'Opening'},
  {value: 'CLOSING', label: 'Closing'},
];

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function ReadingRow({
  reading,
  fridgeName,
}: {
  reading: TemperatureReading;
  fridgeName: string;
}): React.JSX.Element {
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.name}>{fridgeName}</Text>
          <Text style={styles.hint}>
            {ROUTINE_LABELS[reading.routine]} · {formatDateTime(reading.recorded_at)}
          </Text>
          <Text style={styles.hint}>Logged by {reading.recorded_by_name ?? 'Unknown'}</Text>
          {reading.note ? <Text style={styles.noteText}>Note: {reading.note}</Text> : null}
        </View>
        <Text
          style={[styles.value, {color: reading.is_within_range ? colors.success : colors.danger}]}>
          {reading.celsius}°C
        </Text>
      </View>
    </Card>
  );
}

/** Every fridge/freezer temperature reading over a chosen window, most
 * recent first - the manager's record that daily opening/closing checks
 * actually happened, not just today's snapshot. Admin-only: staff see and
 * correct today's reading in RoutineScreen/FridgeTemperaturesScreen, but
 * looking back over past days is a manager's job, not a floor task. */
export function ComplianceHistoryScreen(): React.JSX.Element {
  const [rangeDays, setRangeDays] = useState<RangeDays>('14');
  const [routineFilter, setRoutineFilter] = useState<RoutineFilter>('ALL');

  const fridges = useFridgeUnits();
  const history = useTemperatureReadingHistory({
    dateFrom: isoDaysAgo(Number(rangeDays)),
    dateTo: todayIso(),
  });

  const loading = fridges.isLoading || history.isLoading;
  const anyError = fridges.error || history.error;

  function refresh() {
    fridges.refetch();
    history.refetch();
  }

  if (loading) {
    return <LoadingView />;
  }
  if (anyError) {
    return (
      <ErrorState
        message={describeApiError(anyError, 'Could not load temperature history.')}
        onRetry={refresh}
      />
    );
  }

  const fridgeNameById = new Map(fridges.data?.results.map(f => [f.id, f.name]) ?? []);
  const readings = (history.data?.results ?? []).filter(
    reading => routineFilter === 'ALL' || reading.routine === routineFilter,
  );

  return (
    <Screen onRefresh={refresh} refreshing={fridges.isRefetching || history.isRefetching}>
      <Text style={styles.heading}>Temperature history</Text>

      <SegmentedToggle
        options={RANGE_OPTIONS}
        value={rangeDays}
        onChange={setRangeDays}
        accessibilityLabel="How far back to look"
        compact
      />
      <SegmentedToggle
        options={ROUTINE_FILTERS}
        value={routineFilter}
        onChange={setRoutineFilter}
        accessibilityLabel="Which checks to show"
        compact
      />

      {readings.length === 0 ? (
        <EmptyState
          title="No readings in this window"
          body="Temperature readings staff record will show up here."
        />
      ) : (
        readings.map((reading, index) => (
          <FadeIn key={reading.id} delay={Math.min(index * 30, 300)}>
            <ReadingRow
              reading={reading}
              fridgeName={fridgeNameById.get(reading.fridge_unit) ?? 'Unknown fridge'}
            />
          </FadeIn>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 20, fontWeight: '700', color: colors.text},
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  rowText: {flex: 1},
  name: {fontSize: 15, fontWeight: '600', color: colors.text},
  hint: {fontSize: 12, color: colors.textMuted, marginTop: 2},
  noteText: {fontSize: 12, color: colors.textMuted, marginTop: 2, fontStyle: 'italic'},
  value: {fontSize: 18, fontWeight: '700'},
});
