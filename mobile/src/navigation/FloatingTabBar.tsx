import React, {useEffect, useRef, useState} from 'react';
import {Animated, StyleSheet, View} from 'react-native';
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';

import {PressableScale} from '../components/PressableScale';
import {colors, radii, spacing, TAB_ICON_SIZE} from '../theme';

/** The bar itself - the dark pill the tabs sit in. */
const BAR_HEIGHT = 62;
/** The hole punched in the bar, in the page's own colour. */
const BITE = 64;
/** The circle carrying the active icon, centred in that hole. */
const KNOB = 52;
/** How far the knob's centre sits above the bar's top edge. All of the depth
 * of the dip comes from this: at 0 the hole would be a half-circle. */
const LIFT = 12;
const OVERHANG = BITE / 2 + LIFT;

/**
 * The bottom navigation: a floating pill, with whichever tab is active lifted
 * out of it into a circle of its own.
 *
 * The lift is doing the work that colour alone was doing before. Five tabs of
 * identical glyphs, one of them amber, is a weak signal at a glance and no
 * signal at all to anyone who cannot separate amber from grey; a circle that
 * has physically left the bar is neither. The icon still changes weight and
 * colour too, so there are three cues where there was one.
 *
 * The hole is a circle of the page's own colour laid over the bar, rather than
 * a bar drawn with a notch in it. Same picture, and it means the only thing
 * that moves between tabs is one transform, on the native driver - the bar
 * underneath is never redrawn.
 */
function FloatingTabBar({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps): React.JSX.Element {
  const [barWidth, setBarWidth] = useState(0);
  const slide = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    const animation = Animated.spring(slide, {
      toValue: state.index,
      useNativeDriver: true,
      speed: 14,
      bounciness: 7,
    });
    animation.start();
    return () => animation.stop();
  }, [slide, state.index]);

  const tabWidth = barWidth > 0 ? barWidth / state.routes.length : 0;
  const translateX = slide.interpolate({
    inputRange: state.routes.map((_, index) => index),
    outputRange: state.routes.map((_, index) => index * tabWidth),
  });

  const activeRoute = state.routes[state.index];
  const activeIcon = activeRoute
    ? descriptors[activeRoute.key]?.options.tabBarIcon?.({
        focused: true,
        color: colors.primary,
        size: 26,
      })
    : null;

  return (
    <View
      style={[styles.container, {paddingBottom: Math.max(insets.bottom, spacing.sm)}]}
      pointerEvents="box-none">
      <View
        style={styles.barWrap}
        onLayout={event => setBarWidth(event.nativeEvent.layout.width)}
        pointerEvents="box-none">
        <View style={styles.bar} />

        {/* Measured first, drawn second: a knob that starts at the far left
            and jumps to the right tab is worse than one that appears already
            under it. */}
        {tabWidth > 0 ? (
          <Animated.View
            style={[styles.floating, {width: tabWidth, transform: [{translateX}]}]}
            pointerEvents="none">
            <View style={styles.bite} />
            <View style={styles.knob}>{activeIcon}</View>
          </Animated.View>
        ) : null}

        <View style={styles.row}>
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
                {/* The active one is up in the knob, so drawing it here too
                    would show it twice - but only once the knob exists. Until
                    the bar has been measured there is no knob, and skipping it
                    here as well would leave the active tab with no icon at
                    all for that frame. */}
                {focused && tabWidth > 0
                  ? null
                  : options.tabBarIcon?.({
                      focused,
                      color: focused ? colors.primary : colors.textMuted,
                      size: TAB_ICON_SIZE,
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
  // Tall enough to hold the knob where it pokes out, so nothing has to
  // overflow its parent - Android is unreliable about drawing children that
  // do. The screen above is laid out below this whole height.
  container: {backgroundColor: colors.background, paddingHorizontal: spacing.md},
  barWrap: {height: OVERHANG + BAR_HEIGHT},
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BAR_HEIGHT,
    borderRadius: radii.lg + 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  floating: {position: 'absolute', left: 0, top: 0, alignItems: 'center'},
  bite: {
    position: 'absolute',
    top: 0,
    width: BITE,
    height: BITE,
    borderRadius: BITE / 2,
    backgroundColor: colors.background,
  },
  knob: {
    position: 'absolute',
    top: (BITE - KNOB) / 2,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BAR_HEIGHT,
    flexDirection: 'row',
  },
  tab: {flex: 1, alignItems: 'center', justifyContent: 'center'},
});
