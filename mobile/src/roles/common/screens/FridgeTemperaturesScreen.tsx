import React, {useState} from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import {Ionicons} from '@expo/vector-icons';

import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {FadeIn} from '../../../components/FadeIn';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {describeApiError} from '../../../api/errors';
import {
  useFridgeUnits,
  useRecordTemperature,
  useTemperatureReadings,
} from '../../../features/compliance/hooks';
import {ROUTINE_LABELS} from '../../../features/compliance/types';
import type {
  ComplianceRoutine,
  FridgeUnit,
  TemperatureReading,
} from '../../../features/compliance/types';
import type {ComplianceStackParamList} from '../../../navigation/types';
import {colors, radii, spacing} from '../../../theme';

type Route = RouteProp<ComplianceStackParamList, 'FridgeTemperatures'>;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const STEP = 0.5;

function RecordRow({
  fridge,
  reading,
  routine,
  date,
}: {
  fridge: FridgeUnit;
  reading: TemperatureReading | undefined;
  routine: ComplianceRoutine;
  date: string;
}): React.JSX.Element {
  const record = useRecordTemperature();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() =>
    Number(reading?.celsius ?? fridge.recommended_max_celsius),
  );
  const [error, setError] = useState<string | null>(null);

  const maxAllowed = Number(fridge.recommended_max_celsius);
  const wouldBeWithinRange = value <= maxAllowed;

  async function onSave() {
    setError(null);
    try {
      await record.mutateAsync({
        fridge_unit: fridge.id,
        routine,
        date,
        celsius: value,
      });
      setEditing(false);
    } catch (err) {
      setError(describeApiError(err, 'Could not save that reading.'));
    }
  }

  return (
    <Card>
      <View style={styles.row}>
        {fridge.photo ? (
          <Image source={{uri: fridge.photo}} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons
              name={fridge.kind === 'FREEZER' ? 'snow-outline' : 'thermometer-outline'}
              size={24}
              color={colors.textMuted}
            />
          </View>
        )}
        <View style={styles.rowText}>
          <Text style={styles.name}>{fridge.name}</Text>
          <Text style={styles.hint}>{fridge.recommended_max_celsius}°C or lower</Text>
        </View>
        {reading ? (
          <View style={styles.readingBadge}>
            <Text
              style={[
                styles.readingValue,
                {color: reading.is_within_range ? colors.success : colors.danger},
              ]}>
              {reading.celsius}°C
            </Text>
            <Text style={styles.readingBy}>{reading.recorded_by_name}</Text>
          </View>
        ) : null}
      </View>

      {editing ? (
        <View style={styles.editor}>
          <View style={styles.stepper}>
            <Pressable
              style={styles.stepButton}
              onPress={() => setValue(v => Math.round((v - STEP) * 10) / 10)}>
              <Text style={styles.stepButtonText}>−</Text>
            </Pressable>
            <Text
              style={[styles.stepValue, {color: wouldBeWithinRange ? colors.text : colors.danger}]}>
              {value.toFixed(1)}°C
            </Text>
            <Pressable
              style={styles.stepButton}
              onPress={() => setValue(v => Math.round((v + STEP) * 10) / 10)}>
              <Text style={styles.stepButtonText}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>
            Recommended range: {fridge.recommended_max_celsius}°C or lower
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.formActions}>
            <Button title="Cancel" variant="secondary" onPress={() => setEditing(false)} />
            <Button title="Save" onPress={onSave} loading={record.isPending} />
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setEditing(true)}>
          <Text style={styles.link}>{reading ? 'Correct this reading' : 'Record temperature'}</Text>
        </Pressable>
      )}
    </Card>
  );
}

/** Every fridge/freezer, with today's reading for this routine (or the
 * option to record one) - shared across the whole team, see
 * apps.compliance.services.completion on the backend for why recording
 * one again corrects it instead of creating a duplicate. */
export function FridgeTemperaturesScreen(): React.JSX.Element {
  const {
    params: {routine},
  } = useRoute<Route>();
  const date = todayIso();

  const fridges = useFridgeUnits();
  const readings = useTemperatureReadings({date, routine});

  if (fridges.isLoading || readings.isLoading) {
    return <LoadingView />;
  }
  if (fridges.error || readings.error) {
    return (
      <ErrorState
        message={describeApiError(fridges.error ?? readings.error, 'Could not load fridges.')}
        onRetry={() => {
          fridges.refetch();
          readings.refetch();
        }}
      />
    );
  }

  const readingByFridge = new Map(
    (readings.data?.results ?? []).map(reading => [reading.fridge_unit, reading]),
  );
  const fridgeList = fridges.data?.results ?? [];

  return (
    <Screen onRefresh={() => readings.refetch()} refreshing={readings.isRefetching}>
      <Text style={styles.heading}>{ROUTINE_LABELS[routine]} temperatures</Text>

      {fridgeList.length === 0 ? (
        <EmptyState
          title="No fridges or freezers yet"
          body="Ask your manager to add them in Manage compliance."
        />
      ) : (
        fridgeList.map((fridge, index) => (
          <FadeIn key={fridge.id} delay={index * 50}>
            <RecordRow
              fridge={fridge}
              reading={readingByFridge.get(fridge.id)}
              routine={routine}
              date={date}
            />
          </FadeIn>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 18, fontWeight: '700', color: colors.text},
  row: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  photo: {width: 48, height: 48, borderRadius: radii.md},
  photoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {flex: 1},
  name: {fontSize: 15, fontWeight: '600', color: colors.text},
  hint: {fontSize: 12, color: colors.textMuted},
  readingBadge: {alignItems: 'flex-end'},
  readingValue: {fontSize: 16, fontWeight: '700'},
  readingBy: {fontSize: 11, color: colors.textMuted},
  link: {fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: spacing.sm},
  editor: {marginTop: spacing.sm, gap: spacing.sm},
  stepper: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md},
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: {fontSize: 22, fontWeight: '700', color: colors.text},
  stepValue: {fontSize: 24, fontWeight: '700', minWidth: 110, textAlign: 'center'},
  formActions: {flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end'},
  error: {color: colors.danger, fontSize: 12},
});
