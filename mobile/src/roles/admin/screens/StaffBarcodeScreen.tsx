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

  // Captured as a plain string so the closure below doesn't need TS to prove
  // `code` itself stays defined - narrowing on an outer const doesn't carry
  // into a function declared after the guard.
  const codeId = code.id;

  async function onRegenerate() {
    setError(null);
    try {
      await regenerate.mutateAsync(codeId);
    } catch (err) {
      setError(describeApiError(err, 'Could not regenerate the QR code.'));
    }
  }

  return (
    <Screen scroll={false}>
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

        <Button
          title="Regenerate code"
          variant="secondary"
          onPress={onRegenerate}
          loading={regenerate.isPending}
        />
        <Text style={styles.warning}>
          Regenerating invalidates any printed copy of the old code immediately.
        </Text>
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
    setLatitude(String(position.coords.latitude));
    setLongitude(String(position.coords.longitude));
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
        keyboardType="decimal-pad"
        value={latitude}
        onChangeText={setLatitude}
      />
      <TextField
        label="Longitude"
        keyboardType="decimal-pad"
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
});
