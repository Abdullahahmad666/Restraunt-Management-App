import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {FadeIn} from '../../../components/FadeIn';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {describeApiError} from '../../../api/errors';
import {useFridgeUnits, useTemperatureReadingHistory} from '../../../features/compliance/hooks';
import {ROUTINE_LABELS} from '../../../features/compliance/types';
import type {ComplianceRoutine, TemperatureReading} from '../../../features/compliance/types';
import {colors, radii, spacing} from '../../../theme';
import {formatDateTime} from '../../../utils/format';

const RANGE_OPTIONS = [
  {label: '7 days', days: 7},
  {label: '14 days', days: 14},
  {label: '30 days', days: 30},
];

const ROUTINE_FILTERS: Array<{label: string; value: ComplianceRoutine | undefined}> = [
  {label: 'All', value: undefined},
  {label: 'Opening', value: 'OPENING'},
  {label: 'Closing', value: 'CLOSING'},
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
  const [rangeDays, setRangeDays] = useState(14);
  const [routineFilter, setRoutineFilter] = useState<ComplianceRoutine | undefined>();

  const fridges = useFridgeUnits();
  const history = useTemperatureReadingHistory({
    dateFrom: isoDaysAgo(rangeDays),
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
    reading => !routineFilter || reading.routine === routineFilter,
  );

  return (
    <Screen onRefresh={refresh} refreshing={fridges.isRefetching || history.isRefetching}>
      <Text style={styles.heading}>Temperature history</Text>

      <View style={styles.filterRow}>
        {RANGE_OPTIONS.map(option => (
          <Pressable
            key={option.days}
            onPress={() => setRangeDays(option.days)}
            style={[styles.chip, rangeDays === option.days && styles.chipActive]}>
            <Text style={[styles.chipLabel, rangeDays === option.days && styles.chipLabelActive]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.filterRow}>
        {ROUTINE_FILTERS.map(filter => (
          <Pressable
            key={filter.label}
            onPress={() => setRoutineFilter(filter.value)}
            style={[styles.chip, routineFilter === filter.value && styles.chipActive]}>
            <Text
              style={[styles.chipLabel, routineFilter === filter.value && styles.chipLabelActive]}>
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </View>

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
  filterRow: {flexDirection: 'row', gap: spacing.xs},
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  chipActive: {backgroundColor: colors.primary, borderColor: colors.primary},
  chipLabel: {fontSize: 13, color: colors.text},
  chipLabelActive: {color: '#FFFFFF', fontWeight: '600'},
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  rowText: {flex: 1},
  name: {fontSize: 15, fontWeight: '600', color: colors.text},
  hint: {fontSize: 12, color: colors.textMuted, marginTop: 2},
  noteText: {fontSize: 12, color: colors.textMuted, marginTop: 2, fontStyle: 'italic'},
  value: {fontSize: 18, fontWeight: '700'},
});
