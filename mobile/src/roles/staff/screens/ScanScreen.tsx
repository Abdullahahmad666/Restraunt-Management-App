import React, {useEffect, useRef, useState} from 'react';
import {Animated, Dimensions, Linking, StyleSheet, Text, View} from 'react-native';
import {CameraView, useCameraPermissions, type BarcodeScanningResult} from 'expo-camera';
import {Ionicons} from '@expo/vector-icons';
import * as Location from 'expo-location';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Button} from '../../../components/Button';
import {describeApiError} from '../../../api/errors';
import {useScan} from '../../../features/attendance/hooks';
import {colors, radii, spacing} from '../../../theme';
import {roundCoordinate} from '../../../utils/coords';
import type {StaffStackParamList} from '../../../navigation/types';

type Nav = NativeStackNavigationProp<StaffStackParamList>;

const FRAME_SIZE = Math.min(Dimensions.get('window').width - spacing.xl * 2, 280);
const CORNER_LENGTH = 32;

/** The bracket-and-scan-line viewfinder drawn over the camera - a plain full-
 * screen camera preview gives no sense of where to point the phone, or that
 * anything is actively happening while it waits for a code. */
function Viewfinder(): React.JSX.Element {
  const sweep = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const sweepLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {toValue: 1, duration: 1600, useNativeDriver: true}),
        Animated.timing(sweep, {toValue: 0, duration: 1600, useNativeDriver: true}),
      ]),
    );
    // A slow breathing glow on the corners - a static frame reads as inert,
    // this is what says "actively looking" while nothing else changes.
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {toValue: 1, duration: 1100, useNativeDriver: true}),
        Animated.timing(pulse, {toValue: 0, duration: 1100, useNativeDriver: true}),
      ]),
    );
    sweepLoop.start();
    pulseLoop.start();
    return () => {
      sweepLoop.stop();
      pulseLoop.stop();
    };
  }, [sweep, pulse]);

  const cornerOpacity = pulse.interpolate({inputRange: [0, 1], outputRange: [0.6, 1]});

  return (
    <View style={styles.overlay} pointerEvents="none">
      <View style={styles.dimRow}>
        <Text style={styles.headerTitle}>Scan to clock in / out</Text>
        <Text style={styles.headerSubtitle}>Line up the code inside the frame</Text>
      </View>
      <View style={styles.middleRow}>
        <View style={styles.dimSide} />
        <View style={styles.frame}>
          <Animated.View style={[styles.corner, styles.cornerTopLeft, {opacity: cornerOpacity}]} />
          <Animated.View style={[styles.corner, styles.cornerTopRight, {opacity: cornerOpacity}]} />
          <Animated.View
            style={[styles.corner, styles.cornerBottomLeft, {opacity: cornerOpacity}]}
          />
          <Animated.View
            style={[styles.corner, styles.cornerBottomRight, {opacity: cornerOpacity}]}
          />
          <Animated.View
            style={[
              styles.sweepLine,
              {
                transform: [
                  {
                    translateY: sweep.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, FRAME_SIZE - 8],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
        <View style={styles.dimSide} />
      </View>
      <View style={styles.dimRow} />
    </View>
  );
}

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
        latitude: roundCoordinate(position.coords.latitude),
        longitude: roundCoordinate(position.coords.longitude),
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
        onBarcodeScanned={locked ? undefined : handleScan}>
        <Viewfinder />
      </CameraView>

      <View style={styles.footer}>
        <View style={styles.statusCard}>
          <Ionicons
            name={scanMutation.isPending ? 'sync' : 'qr-code-outline'}
            size={20}
            color={colors.primary}
          />
          <Text style={styles.hint}>
            {scanMutation.isPending
              ? 'Checking in...'
              : "Point the camera at Philly's check-in code"}
          </Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  camera: {flex: 1},

  overlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
  dimRow: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  headerTitle: {color: colors.text, fontSize: 18, fontWeight: '700'},
  headerSubtitle: {color: colors.textMuted, fontSize: 13},
  middleRow: {flexDirection: 'row', height: FRAME_SIZE},
  dimSide: {flex: 1, backgroundColor: 'rgba(0,0,0,0.55)'},
  frame: {width: FRAME_SIZE, height: FRAME_SIZE, overflow: 'hidden'},
  corner: {
    position: 'absolute',
    width: CORNER_LENGTH,
    height: CORNER_LENGTH,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 0},
  },
  cornerTopLeft: {top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4},
  cornerTopRight: {top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4},
  cornerBottomLeft: {bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4},
  cornerBottomRight: {bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4},
  sweepLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 0},
  },

  footer: {padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.background},
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  hint: {color: colors.textMuted, flexShrink: 1},
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
  error: {textAlign: 'center', color: colors.danger, fontWeight: '600'},
});
