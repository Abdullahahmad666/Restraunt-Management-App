import React, {useState} from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import {Ionicons} from '@expo/vector-icons';

import {Button} from '../../../components/Button';
import {Screen} from '../../../components/Screen';
import {TextField} from '../../../components/TextField';
import {describeApiError} from '../../../api/errors';
import {
  useAdminFridgeUnits,
  useCreateFridgeUnit,
  useUpdateFridgeUnit,
  useUploadFridgePhoto,
} from '../../../features/compliance/hooks';
import type {FridgeUnitKind} from '../../../features/compliance/types';
import type {AdminStackParamList} from '../../../navigation/types';
import {colors, radii, spacing} from '../../../theme';

type Nav = NativeStackNavigationProp<AdminStackParamList>;
type Route = RouteProp<AdminStackParamList, 'EditFridge'>;

const KINDS: {value: FridgeUnitKind; label: string; defaultMax: string}[] = [
  {value: 'FRIDGE', label: 'Fridge', defaultMax: '5.0'},
  {value: 'FREEZER', label: 'Freezer', defaultMax: '-18.0'},
];

/** Register a new fridge/freezer, or edit an existing one - name, kind,
 * the temperature ceiling readings are checked against, and an optional
 * photo so staff can tell units apart at a glance. */
export function EditFridgeScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const {
    params: {fridgeId},
  } = useRoute<Route>();
  const fridges = useAdminFridgeUnits();
  const existing = fridges.data?.results.find(f => f.id === fridgeId);

  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<FridgeUnitKind>(existing?.kind ?? 'FRIDGE');
  const [maxCelsius, setMaxCelsius] = useState(existing?.recommended_max_celsius ?? '5.0');
  const [error, setError] = useState<string | null>(null);

  const create = useCreateFridgeUnit();
  const update = useUpdateFridgeUnit();
  const uploadPhoto = useUploadFridgePhoto();
  const toggleActive = useUpdateFridgeUnit();

  async function pickPhoto() {
    if (!existing) {
      setError('Save the fridge first, then add a photo.');
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo access is off for Invisiko.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) {
      return;
    }
    try {
      await uploadPhoto.mutateAsync({id: existing.id, uri: result.assets[0].uri});
    } catch (err) {
      setError(describeApiError(err, 'Could not upload that photo.'));
    }
  }

  async function onSave() {
    setError(null);
    if (!name.trim()) {
      setError('Give it a name.');
      return;
    }
    try {
      if (existing) {
        await update.mutateAsync({
          id: existing.id,
          input: {name, kind, recommended_max_celsius: maxCelsius},
        });
      } else {
        await create.mutateAsync({name, kind, recommended_max_celsius: maxCelsius});
      }
      navigation.goBack();
    } catch (err) {
      setError(describeApiError(err, 'Could not save that fridge.'));
    }
  }

  async function onToggleActive() {
    if (!existing) {
      return;
    }
    setError(null);
    try {
      await toggleActive.mutateAsync({id: existing.id, input: {is_active: !existing.is_active}});
    } catch (err) {
      setError(describeApiError(err, 'Could not update that fridge.'));
    }
  }

  const saving = create.isPending || update.isPending;

  return (
    <Screen>
      <Pressable style={styles.photoPicker} onPress={pickPhoto} disabled={uploadPhoto.isPending}>
        {existing?.photo ? (
          <Image source={{uri: existing.photo}} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
          </View>
        )}
        <Text style={styles.photoLink}>
          {existing ? 'Change photo' : 'Save first to add a photo'}
        </Text>
      </Pressable>

      <TextField label="Name" placeholder="e.g. Fridge 1" value={name} onChangeText={setName} />

      <Text style={styles.label}>Type</Text>
      <View style={styles.chipRow}>
        {KINDS.map(option => {
          const selected = kind === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                setKind(option.value);
                if (!existing) {
                  setMaxCelsius(option.defaultMax);
                }
              }}
              style={[styles.chip, selected && styles.chipSelected]}>
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextField
        label="Recommended max (°C)"
        keyboardType="numbers-and-punctuation"
        value={maxCelsius}
        onChangeText={setMaxCelsius}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title={existing ? 'Save changes' : 'Add fridge'} onPress={onSave} loading={saving} />

      {existing ? (
        <Button
          title={existing.is_active ? 'Deactivate' : 'Reactivate'}
          variant="secondary"
          onPress={onToggleActive}
          loading={toggleActive.isPending}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photoPicker: {alignItems: 'center', gap: spacing.xs},
  photo: {width: 96, height: 72, borderRadius: radii.md},
  photoPlaceholder: {
    width: 96,
    height: 72,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLink: {fontSize: 12, color: colors.primary, fontWeight: '600'},
  label: {fontSize: 13, fontWeight: '600', color: colors.textMuted},
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipSelected: {backgroundColor: colors.primary, borderColor: colors.primary},
  chipText: {fontSize: 13, color: colors.text},
  chipTextSelected: {color: '#FFFFFF', fontWeight: '700'},
  error: {color: colors.danger, fontSize: 13},
});
