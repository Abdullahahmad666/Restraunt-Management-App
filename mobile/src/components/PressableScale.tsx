import React from 'react';
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {usePressScale} from '../hooks/usePressScale';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** How far the press dips it. See usePressScale. */
  scaleTo?: number;
  children?: React.ReactNode;
};

/**
 * A Pressable that animates itself, used in place of the plain one wherever a
 * tap does something.
 *
 * The transform sits on the Pressable rather than on a wrapper View inside it,
 * so nothing extra enters the layout and callers can drop this in where they
 * had a Pressable without their spacing shifting.
 *
 * `style` is a plain style here, not Pressable's ({pressed}) => style form.
 * That form only exists to restyle on press, which is what the animation now
 * does - keeping both would mean two competing answers to the same question,
 * and a static opacity change fighting a spring looks like a glitch.
 */
export function PressableScale({
  style,
  scaleTo,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: Props): React.JSX.Element {
  const {scaleStyle, pressIn, pressOut} = usePressScale(scaleTo);

  return (
    <AnimatedPressable
      {...rest}
      style={[style, scaleStyle]}
      onPressIn={(event: GestureResponderEvent) => {
        pressIn();
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        pressOut();
        onPressOut?.(event);
      }}>
      {children}
    </AnimatedPressable>
  );
}
