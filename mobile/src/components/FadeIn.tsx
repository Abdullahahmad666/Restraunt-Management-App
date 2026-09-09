import React, {useEffect, useRef} from 'react';
import {Animated} from 'react-native';

/**
 * Fades and slides its children up on mount. No animation library - just
 * RN's built-in Animated API, so it costs nothing to add anywhere.
 *
 * `delay` staggers a list: pass `index * 60` or similar so rows cascade in
 * rather than all popping at once.
 */
export function FadeIn({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: object;
}): React.JSX.Element {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 280,
      delay,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
}
