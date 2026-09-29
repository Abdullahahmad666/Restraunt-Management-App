import {useCallback, useRef} from 'react';
import {Animated} from 'react-native';

/**
 * The app's one press motion: dip on touch, settle back with a slight
 * overshoot on release.
 *
 * Every tappable thing shares this so a press feels the same wherever it
 * happens. It exists as a hook rather than a style because a dark,
 * near-monochrome palette has almost no colour left to signal "pressed" with -
 * an opacity nudge on a black surface is close to invisible - so the movement
 * carries that feedback instead.
 *
 * Native driver throughout: the animation runs on the UI thread and keeps up
 * even while JS is busy re-rendering the screen the press just changed, which
 * is exactly when a dropped frame would be noticed.
 *
 * `scaleTo` is how far it dips. Smaller controls need a smaller dip to read as
 * deliberate rather than twitchy, so buttons use the default and larger
 * surfaces (grid tiles) ask for a little more.
 */
export function usePressScale(scaleTo = 0.97): {
  scaleStyle: {transform: [{scale: Animated.Value}]};
  pressIn: () => void;
  pressOut: () => void;
} {
  const scale = useRef(new Animated.Value(1)).current;

  // Down fast, back slower and with a touch of bounce. Matching speeds in both
  // directions reads as mechanical; the asymmetry is what makes it feel
  // physical.
  const pressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  }, [scale, scaleTo]);

  const pressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [scale]);

  return {scaleStyle: {transform: [{scale}]}, pressIn, pressOut};
}
