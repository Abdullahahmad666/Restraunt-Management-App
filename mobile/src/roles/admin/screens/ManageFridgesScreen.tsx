import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Ionicons} from '@expo/vector-icons';

import {Badge} from '../../../components/Badge';
import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {FadeIn} from '../../../components/FadeIn';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {describeApiError} from '../../../api/errors';
import {useAdminFridgeUnits} from '../../../features/compliance/hooks';
import type {AdminStackParamList} from '../../../navigation/types';
import {colors, radii, spacing} from '../../../theme';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

/** Every fridge/freezer registered at the restaurant, active or not - tap
 * one to edit, or add a new one. Deactivated units stay listed (greyed
 * out) rather than disappearing, since their past readings are still
 * real compliance history. */
export function ManageFridgesScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const fridges = useAdminFridgeUnits();

  if (fridges.isLoading) {
    return <LoadingView />;
  }
  if (fridges.error) {
    return (
      <ErrorState
        message={describeApiError(fridges.error, 'Could not load fridges.')}
        onRetry={() => fridges.refetch()}
      />
    );
  }

  const fridgeList = fridges.data?.results ?? [];

  return (
    <Screen onRefresh={() => fridges.refetch()} refreshing={fridges.isRefetching}>
      <Text style={styles.heading}>Fridges & freezers</Text>

      {fridgeList.length === 0 ? (
        <EmptyState title="None yet" body="Add your first fridge or freezer below." />
      ) : (
        fridgeList.map((fridge, index) => (
          <FadeIn key={fridge.id} delay={index * 50}>
            <Pressable onPress={() => navigation.navigate('EditFridge', {fridgeId: fridge.id})}>
              <Card style={styles.row}>
                {fridge.photo ? (
                  <Image source={{uri: fridge.photo}} style={styles.photo} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons
                      name={fridge.kind === 'FREEZER' ? 'snow-outline' : 'thermometer-outline'}
                      size={22}
                      color={colors.textMuted}
                    />
                  </View>
                )}
                <View style={styles.rowText}>
                  <Text style={styles.name}>{fridge.name}</Text>
                  <Text style={styles.hint}>{fridge.recommended_max_celsius}°C or lower</Text>
                </View>
                {!fridge.is_active ? <Badge label="Inactive" tone="neutral" /> : null}
              </Card>
            </Pressable>
          </FadeIn>
        ))
      )}

      <Button
        title="+ Add fridge or freezer"
        variant="secondary"
        onPress={() => navigation.navigate('EditFridge', {})}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 20, fontWeight: '700', color: colors.text},
  row: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  photo: {width: 44, height: 44, borderRadius: radii.md},
  photoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {flex: 1},
  name: {fontSize: 15, fontWeight: '600', color: colors.text},
  hint: {fontSize: 12, color: colors.textMuted},
});
