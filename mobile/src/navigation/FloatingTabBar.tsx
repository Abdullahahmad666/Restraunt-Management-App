import React, {useEffect, useRef, useState} from 'react';
import {Animated, StyleSheet, View} from 'react-native';
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';

import {PressableScale} from '../components/PressableScale';
import {colors, spacing, TAB_ICON_SIZE} from '../theme';

/** The pill the tabs sit in. */
const BAR_HEIGHT = 64;
/** The circle behind whichever icon is active. */
const KNOB = 48;
/** Breathing room inside the bar, so the circle on the first and last tabs
 * never touches the rounded ends. */
const INSET = 6;

/**
 * The bottom navigation: a floating pill with the active tab marked by a
 * circle that slides between them.
 *
 * The circle used to sit in a notch cut out of the bar's top edge, lifted
 * clear of it. It looked the part and it cost too much: a circle proud of the
 * bar overhangs the screen above, so the last card on every list ran underneath
 * it, and on the first and last tabs the notch bit into the bar's rounded
 * corner. Nothing is above the bar now, so there is nothing to collide with
 * and no corner to eat.
 *
 * Marking the active tab with an amber fill is also what the rest of the app
 * already does - the segmented toggle slides exactly this pill under the option
 * you pick - so the bar now says "selected" the same way everything else does.
 */
function FloatingTabBar({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps): React.JSX.Element {
  const [trackWidth, setTrackWidth] = useState(0);
  const slide = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    const animation = Animated.spring(slide, {
      toValue: state.index,
      useNativeDriver: true,
      speed: 16,
      bounciness: 6,
    });
    animation.start();
    return () => animation.stop();
  }, [slide, state.index]);

  const tabWidth = trackWidth > 0 ? trackWidth / state.routes.length : 0;
  const translateX = slide.interpolate({
    inputRange: state.routes.map((_, index) => index),
    outputRange: state.routes.map((_, index) => index * tabWidth),
  });

  return (
    <View
      style={[
        styles.container,
        // Clear of the home indicator without doubling it. The bar already
        // floats above the bottom of the screen, so the full inset on top of
        // its own margin leaves it stranded halfway up.
        {paddingBottom: Math.max(insets.bottom - spacing.sm, spacing.sm)},
      ]}
      pointerEvents="box-none">
      <View style={styles.bar}>
        <View
          style={styles.track}
          onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}>
          {/* Drawn only once the track has been measured: a circle that starts
              under the first tab and jumps to the right one is worse than one
              that appears already under it. */}
          {tabWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.knob, {width: tabWidth, transform: [{translateX}]}]}>
              <View style={styles.knobFill} />
            </Animated.View>
          ) : null}

          {state.routes.map((route, index) => {
            const options = descriptors[route.key]?.options ?? {};
            const focused = state.index === index;
            const label =
              typeof options.tabBarLabel === 'string'
                ? options.tabBarLabel
                : options.title ?? route.name;

            function onPress() {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              // Tapping the tab you are already on pops its stack rather than
              // navigating, which is what the default bar does and what every
              // other app does.
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            }

            return (
              <PressableScale
                key={route.key}
                onPress={onPress}
                onLongPress={() => navigation.emit({type: 'tabLongPress', target: route.key})}
                scaleTo={0.9}
                accessibilityRole="tab"
                accessibilityState={{selected: focused}}
                accessibilityLabel={label}
                style={styles.tab}>
                {/* Dark ink on the amber, the way every other picked thing in
                    the app is drawn - white on this amber fails contrast. */}
                {options.tabBarIcon?.({
                  focused,
                  color: focused ? colors.onPrimary : colors.textMuted,
                  size: focused ? 24 : TAB_ICON_SIZE,
                })}
              </PressableScale>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/**
 * What a navigator passes as its `tabBar`.
 *
 * It has to be this wrapper and not FloatingTabBar itself. React Navigation
 * *calls* the tabBar prop - `insets => tabBar({...})` in BottomTabView - rather
 * than rendering it as an element, so a component handed over directly runs
 * its hooks outside any component and React refuses them outright: "Invalid
 * hook call", and a blank screen where the app was.
 *
 * Defined out here, at module scope, so it is the same function on every
 * render of the navigator.
 */
export function renderFloatingTabBar(props: BottomTabBarProps): React.JSX.Element {
  return <FloatingTabBar {...props} />;
}

const styles = StyleSheet.create({
  container: {backgroundColor: colors.background, paddingHorizontal: spacing.md},
  bar: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: INSET,
  },
  track: {flexDirection: 'row'},
  knob: {position: 'absolute', left: 0, top: 0, bottom: 0, alignItems: 'center'},
  knobFill: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.primary,
  },
  tab: {flex: 1, alignItems: 'center', justifyContent: 'center', height: KNOB},
});
