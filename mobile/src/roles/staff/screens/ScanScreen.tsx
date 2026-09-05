import React, {useState} from 'react';
import {Linking, StyleSheet, Text, View} from 'react-native';
import {CameraView, useCameraPermissions, type BarcodeScanningResult} from 'expo-camera';
import {Ionicons} from '@expo/vector-icons';
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
    // canAskAgain false means the OS will not show the prompt again, so
    // calling requestPermission is a button that visibly does nothing. The
    // only route left is the app's own settings page.
    const blocked = !permission.canAskAgain;

    return (
      <View style={styles.permission}>
        <View style={styles.permissionIcon}>
          <Ionicons name="camera-outline" size={36} color={colors.primary} />
        </View>

        <Text style={styles.permissionTitle}>Camera access needed</Text>

        <Text style={styles.permissionBody}>
          {blocked
            ? 'Camera access is turned off for Invisiko. Turn it on in Settings to scan your barcode at the start and end of a shift.'
            : 'Invisiko uses the camera to scan your barcode when you start and finish a shift. It is only used while this screen is open, and nothing is recorded.'}
        </Text>

        <View style={styles.permissionActions}>
          <Button
            title={blocked ? 'Open Settings' : 'Allow camera access'}
            onPress={() => {
              if (blocked) {
                Linking.openSettings();
              } else {
                requestPermission();
              }
            }}
          />
        </View>

        <Text style={styles.permissionNote}>
          No camera? Ask your manager to record the shift for you.
        </Text>
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
  permission: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  permissionIcon: {
    width: 76,
    height: 76,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  permissionTitle: {fontSize: 20, fontWeight: '700', color: colors.text},
  permissionBody: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionActions: {alignSelf: 'stretch', marginTop: spacing.lg},
  permissionNote: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  hint: {textAlign: 'center', color: colors.textMuted},
  error: {textAlign: 'center', color: colors.danger, fontWeight: '600'},
});
