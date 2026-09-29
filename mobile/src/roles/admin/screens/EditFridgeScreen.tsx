import React, {useState} from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import {Ionicons} from '@expo/vector-icons';

import {Button} from '../../../components/Button';
import {Screen} from '../../../components/Screen';
import {SegmentedToggle, type SegmentedOption} from '../../../components/SegmentedToggle';
import {TextField} from '../../../components/TextField';
import {describeApiError} from '../../../api/errors';
import {compressImage, EQUIPMENT_PHOTO} from '../../../utils/media';
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

const KINDS: (SegmentedOption<FridgeUnitKind> & {defaultMax: string})[] = [
  {value: 'FRIDGE', label: 'Fridge', icon: 'thermometer-outline', defaultMax: '5.0'},
  {value: 'FREEZER', label: 'Freezer', icon: 'snow-outline', defaultMax: '-18.0'},
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
      // Compressed below rather than here, so every upload in the app uses
      // one set of profiles - see utils/media.ts.
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) {
      return;
    }
    try {
      const asset = result.assets[0];
      const prepared = await compressImage(asset.uri, EQUIPMENT_PHOTO, {
        width: asset.width,
        height: asset.height,
        name: 'fridge.jpg',
      });
      await uploadPhoto.mutateAsync({id: existing.id, uri: prepared.uri});
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
      <SegmentedToggle
        options={KINDS}
        value={kind}
        onChange={next => {
          setKind(next);
          // Only for a new one: a manager editing an existing fridge may have
          // tuned its ceiling by hand, and resetting that to the default
          // because they touched the kind would quietly undo their work.
          if (!existing) {
            setMaxCelsius(KINDS.find(option => option.value === next)?.defaultMax ?? '');
          }
        }}
        accessibilityLabel="Fridge or freezer"
      />

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
  error: {color: colors.danger, fontSize: 13},
});
