import React, {useRef} from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

import {PressableScale} from './PressableScale';
import {colors, radii, spacing, typography} from '../theme';

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function distanceBetween(event: GestureResponderEvent): number {
  const [first, second] = event.nativeEvent.touches;
  if (!first || !second) {
    return 0;
  }
  return Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY);
}

/**
 * A document, full screen, with pinch to zoom.
 *
 * In the app rather than handed to the browser. Opening the file's own URL
 * does work and is one line - but it is a signed storage URL, so what somebody
 * gets is a browser window with an AWS address in it, which is not what you
 * want to be showing an inspector over the counter.
 *
 * Zoom is hand-rolled on PanResponder because nothing here ships a gesture
 * library, and the alternative - a flat picture you cannot magnify - fails the
 * one thing a certificate is for: the small print at the bottom with the
 * registration number on it.
 */
export function ImageViewer({
  visible,
  uri,
  title,
  onClose,
}: {
  visible: boolean;
  uri: string;
  title?: string;
  onClose: () => void;
}): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Where the gesture started, and where the last one left off. Kept in refs
  // rather than state: these change on every frame of a pinch, and a
  // re-render per frame is how a smooth gesture turns into a slideshow.
  const pinchStart = useRef(0);
  const scaleAt = useRef(1);
  const offset = useRef({x: 0, y: 0});
  const panStart = useRef({x: 0, y: 0});

  function reset() {
    scaleAt.current = 1;
    offset.current = {x: 0, y: 0};
    Animated.parallel([
      Animated.spring(scale, {toValue: 1, useNativeDriver: true, bounciness: 2}),
      Animated.spring(translateX, {toValue: 0, useNativeDriver: true, bounciness: 2}),
      Animated.spring(translateY, {toValue: 0, useNativeDriver: true, bounciness: 2}),
    ]).start();
  }

  const gestures = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: event => {
        pinchStart.current = distanceBetween(event);
        panStart.current = {
          x: event.nativeEvent.pageX - offset.current.x,
          y: event.nativeEvent.pageY - offset.current.y,
        };
      },
      onPanResponderMove: (event, gesture) => {
        const touches = event.nativeEvent.touches;

        if (touches.length >= 2) {
          const spread = distanceBetween(event);
          if (pinchStart.current === 0) {
            pinchStart.current = spread;
            return;
          }
          const next = Math.min(
            MAX_SCALE,
            Math.max(MIN_SCALE, scaleAt.current * (spread / pinchStart.current)),
          );
          scale.setValue(next);
          return;
        }

        // One finger only moves the picture once there is something to move
        // it around in - otherwise a swipe on an unzoomed image drags it off
        // centre for no reason.
        if (scaleAt.current > 1) {
          translateX.setValue(offset.current.x + gesture.dx);
          translateY.setValue(offset.current.y + gesture.dy);
        }
      },
      onPanResponderRelease: (event, gesture) => {
        if (event.nativeEvent.touches.length === 0) {
          pinchStart.current = 0;
        }
        // @ts-expect-error - Animated.Value carries its current value here,
        // and reading it is the only way to settle a gesture that set it
        // directly rather than animating to it.
        scaleAt.current = scale.__getValue();

        if (scaleAt.current <= MIN_SCALE + 0.01) {
          reset();
          return;
        }
        offset.current = {
          x: offset.current.x + gesture.dx,
          y: offset.current.y + gesture.dy,
        };
      },
    }),
  ).current;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <PressableScale
            onPress={() => {
              reset();
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.close}>
            <Ionicons name="close" size={20} color={colors.text} />
          </PressableScale>
        </View>

        <View style={styles.stage} {...gestures.panHandlers}>
          <Animated.Image
            source={{uri}}
            resizeMode="contain"
            accessibilityLabel={title}
            style={[styles.image, {transform: [{scale}, {translateX}, {translateY}]}]}
          />
        </View>

        <Text style={styles.hint}>Pinch to zoom. Double tap the close button to go back.</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // True black rather than the app's near-black: a document is being read
  // here, and anything around it competing for attention is in the way.
  screen: {flex: 1, backgroundColor: '#000000'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {...typography.body, fontWeight: '700', color: colors.text, flex: 1},
  close: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  stage: {flex: 1, overflow: 'hidden'},
  image: {flex: 1, width: '100%'},
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingBottom: spacing.xl,
  },
});
