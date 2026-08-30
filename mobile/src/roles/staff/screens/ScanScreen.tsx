import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {CameraView, useCameraPermissions, type BarcodeScanningResult} from 'expo-camera';
import * as Location from 'expo-location';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Button} from '../../../components/Button';
import {describeApiError} from '../../../api/errors';
import {useScan} from '../../../features/attendance/hooks';
import {colors, spacing} from '../../../theme';
import type {StaffStackParamList} from '../../../navigation/types';

type Nav = NativeStackNavigationProp<StaffStackParamList>;

/** Camera QR scan: one button that clocks a staff member in or out. */
export function ScanScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scanMutation = useScan();

  async function handleScan({data: token}: BarcodeScanningResult) {
    if (locked) {
      return;
    }
    setLocked(true);
    setError(null);

    try {
      const location = await Location.requestForegroundPermissionsAsync();
      if (location.status !== 'granted') {
        setError('Location permission is required to check in.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const result = await scanMutation.mutateAsync({
        token,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      navigation.navigate('ScanResult', {action: result.action, log: result.log});
    } catch (err) {
      setError(describeApiError(err, 'Could not check in.'));
    } finally {
      // A brief cooldown, not an immediate unlock - re-pointing the camera at
      // the same still-visible code should not fire a second scan instantly.
      setTimeout(() => setLocked(false), 2000);
    }
  }

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>
          Camera access is needed to scan the check-in code at the venue.
        </Text>
        <Button title="Grant camera access" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{barcodeTypes: ['qr']}}
        onBarcodeScanned={locked ? undefined : handleScan}
      />
      <View style={styles.footer}>
        <Text style={styles.hint}>Point the camera at Philly's check-in code.</Text>
        {scanMutation.isPending ? <Text style={styles.hint}>Checking in...</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  camera: {flex: 1},
  footer: {padding: spacing.lg, gap: spacing.sm},
  message: {padding: spacing.lg, fontSize: 15, color: colors.textMuted},
  hint: {textAlign: 'center', color: colors.textMuted},
  error: {textAlign: 'center', color: colors.danger, fontWeight: '600'},
});
