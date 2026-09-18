import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import * as Location from 'expo-location';
import QRCode from 'react-native-qrcode-svg';

import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
import {ErrorState} from '../../../components/ErrorState';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {TextField} from '../../../components/TextField';
import {describeApiError} from '../../../api/errors';
import {
  useCreateVenueQrCode,
  useRegenerateVenueQrCode,
  useVenueQrCodes,
} from '../../../features/attendance/hooks';
import {useAuthStore} from '../../../store/authStore';
import {colors, spacing} from '../../../theme';
import {roundCoordinate} from '../../../utils/coords';

/** decimal-pad has no minus key on either platform, and a longitude west of
 * Greenwich or a latitude south of the equator needs one - there is no
 * numeric keyboardType that reliably includes "-" on both iOS and Android,
 * so this falls back to the ordinary text keyboard, which always has it. */
const COORDINATE_KEYBOARD_TYPE = 'default';

/**
 * The venue's single check-in QR code, printed and displayed at the door.
 *
 * There is no per-staff barcode on the backend, only one VenueQRCode per
 * restaurant - staff identity comes from their own login, not the code.
 */
export function StaffBarcodeScreen(): React.JSX.Element {
  const qrCodes = useVenueQrCodes();
  const regenerate = useRegenerateVenueQrCode();
  const [error, setError] = useState<string | null>(null);

  if (qrCodes.isLoading) {
    return <LoadingView />;
  }
  if (qrCodes.error) {
    return (
      <ErrorState
        message={describeApiError(qrCodes.error, 'Could not load the QR code.')}
        onRetry={() => qrCodes.refetch()}
      />
    );
  }

  const code = qrCodes.data?.results[0];

  if (!code) {
    return <CreateQrCodeForm />;
  }

  return <ExistingQrCode code={code} regenerate={regenerate} error={error} setError={setError} />;
}

/** Regenerating rotates the token, but also asks for the venue's
 * position/radius again rather than silently keeping whatever was set last
 * time - the geofence needs updating if the venue moved, and "regenerate"
 * is the moment a manager is already here to fix it. */
function ExistingQrCode({
  code,
  regenerate,
  error,
  setError,
}: {
  code: NonNullable<ReturnType<typeof useVenueQrCodes>['data']>['results'][number];
  regenerate: ReturnType<typeof useRegenerateVenueQrCode>;
  error: string | null;
  setError: (error: string | null) => void;
}): React.JSX.Element {
  const [editingLocation, setEditingLocation] = useState(false);
  const [latitude, setLatitude] = useState(String(code.latitude));
  const [longitude, setLongitude] = useState(String(code.longitude));
  const [radius, setRadius] = useState(String(code.radius_meters));

  async function useCurrentLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      setError('Location permission is required to set the venue position.');
      return;
    }
    const position = await Location.getCurrentPositionAsync({});
    setLatitude(String(roundCoordinate(position.coords.latitude)));
    setLongitude(String(roundCoordinate(position.coords.longitude)));
  }

  async function onRegenerate() {
    setError(null);
    try {
      await regenerate.mutateAsync({
        id: code.id,
        input: {
          latitude: Number(latitude),
          longitude: Number(longitude),
          radius_meters: Number(radius) || code.radius_meters,
        },
      });
      setEditingLocation(false);
    } catch (err) {
      setError(describeApiError(err, 'Could not regenerate the QR code.'));
    }
  }

  return (
    <Screen scroll={editingLocation}>
      <View style={styles.center}>
        <View style={styles.qrWrap}>
          <QRCode value={code.token} size={220} />
        </View>
        <Text style={styles.hint}>Print this and display it at the venue entrance.</Text>

        <Card>
          <Text style={styles.row}>Radius: {code.radius_meters}m</Text>
          <Text style={styles.row}>Status: {code.is_active ? 'Active' : 'Inactive'}</Text>
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {editingLocation ? (
          <Card style={styles.locationCard}>
            <Text style={styles.hint}>
              Confirm the venue's position - staff must be within this radius to check in.
            </Text>
            <Button
              title="Use my current location"
              variant="secondary"
              onPress={useCurrentLocation}
            />
            <TextField
              label="Latitude"
              keyboardType={COORDINATE_KEYBOARD_TYPE}
              value={latitude}
              onChangeText={setLatitude}
            />
            <TextField
              label="Longitude"
              keyboardType={COORDINATE_KEYBOARD_TYPE}
              value={longitude}
              onChangeText={setLongitude}
            />
            <TextField
              label="Radius (meters)"
              keyboardType="number-pad"
              value={radius}
              onChangeText={setRadius}
            />
            <View style={styles.actions}>
              <View style={styles.actionButton}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={() => setEditingLocation(false)}
                />
              </View>
              <View style={styles.actionButton}>
                <Button
                  title="Regenerate"
                  onPress={onRegenerate}
                  loading={regenerate.isPending}
                  disabled={!latitude || !longitude}
                />
              </View>
            </View>
          </Card>
        ) : (
          <>
            <Button
              title="Regenerate code"
              variant="secondary"
              onPress={() => setEditingLocation(true)}
            />
            <Text style={styles.warning}>
              Regenerating invalidates any printed copy of the old code immediately.
            </Text>
          </>
        )}
      </View>
    </Screen>
  );
}

function CreateQrCodeForm(): React.JSX.Element {
  const restaurant = useAuthStore(state => state.user?.restaurant);
  const createQrCode = useCreateVenueQrCode();
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('100');
  const [error, setError] = useState<string | null>(null);

  async function useCurrentLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      setError('Location permission is required to set the venue position.');
      return;
    }
    const position = await Location.getCurrentPositionAsync({});
    // Six decimals is what the column holds, and showing more in the field
    // than gets stored just invites a mismatch when it is read back.
    setLatitude(String(roundCoordinate(position.coords.latitude)));
    setLongitude(String(roundCoordinate(position.coords.longitude)));
  }

  async function onSubmit() {
    setError(null);
    if (!restaurant) {
      setError('No restaurant on this account.');
      return;
    }
    try {
      await createQrCode.mutateAsync({
        restaurant,
        latitude: Number(latitude),
        longitude: Number(longitude),
        radius_meters: Number(radius) || 100,
      });
    } catch (err) {
      setError(describeApiError(err, 'Could not create the QR code.'));
    }
  }

  return (
    <Screen scroll>
      <Text style={styles.heading}>No check-in code yet</Text>
      <Text style={styles.hint}>
        Set the venue's position - staff must be within this radius to check in.
      </Text>

      <Button title="Use my current location" variant="secondary" onPress={useCurrentLocation} />

      <TextField
        label="Latitude"
        keyboardType={COORDINATE_KEYBOARD_TYPE}
        value={latitude}
        onChangeText={setLatitude}
      />
      <TextField
        label="Longitude"
        keyboardType={COORDINATE_KEYBOARD_TYPE}
        value={longitude}
        onChangeText={setLongitude}
      />
      <TextField
        label="Radius (meters)"
        keyboardType="number-pad"
        value={radius}
        onChangeText={setRadius}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title="Create check-in code"
        onPress={onSubmit}
        loading={createQrCode.isPending}
        disabled={!latitude || !longitude}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  qrWrap: {backgroundColor: '#FFFFFF', padding: spacing.lg, borderRadius: 12},
  heading: {fontSize: 20, fontWeight: '700', color: colors.text},
  hint: {fontSize: 14, color: colors.textMuted, textAlign: 'center'},
  row: {fontSize: 14, color: colors.text},
  warning: {fontSize: 12, color: colors.warning, textAlign: 'center'},
  error: {color: colors.danger, textAlign: 'center'},
  locationCard: {width: '100%', gap: spacing.sm},
  actions: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  actionButton: {flexGrow: 1, flexBasis: 120},
});
