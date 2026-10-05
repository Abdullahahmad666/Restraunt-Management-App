import React, {useEffect, useRef, useState} from 'react';
import {Animated, StyleSheet, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';

import {PressableScale} from '../components/PressableScale';
import {colors, radii, spacing, TAB_ICON_SIZE} from '../theme';

/** The pill the tabs sit in. */
const BAR_HEIGHT = 56;
/** The circle carrying the active icon. */
const KNOB = 48;
/** The bite taken out of the bar. Wider than the knob by design - the
 * difference between the two is the ring of page colour that separates
 * them. */
const NOTCH_R = 30;
/** How far the knob's centre sits above the bar's top edge. This sets how deep
 * the bite goes: at 0 it would be a half-circle. */
const LIFT = 16;
/** How far the bar's edge rises on its way into the bite. Without it the edge
 * meets the circle at a corner; with it, the two flow together. */
const RISE = 6;
/** The width that rise is spread over, on each side. */
const FILLET = 16;
/** Room above the bar's edge for that rise. */
const TOP_PAD = 8;

/**
 * All of the geometry below is in the cut-out's own coordinates, where y runs
 * down from TOP_PAD above the bar's edge:
 *
 *   y = 0            top of the cut-out
 *   y = MOUTH_Y      the raised edge, where it meets the circle
 *   y = TOP_PAD      the bar's own top edge, away from the bite
 *   y = CUT_H        the bottom of the bite
 */
const CENTRE_Y = TOP_PAD - LIFT;
const MOUTH_Y = TOP_PAD - RISE;
/** Where the bite's edge meets the bar, measured sideways from its centre:
 * the half-chord of the circle at the height the raised edge reaches. */
const MOUTH = Math.round(Math.sqrt(NOTCH_R ** 2 - (MOUTH_Y - CENTRE_Y) ** 2));
const CUT_W = (MOUTH + FILLET) * 2;
const CUT_H = CENTRE_Y + NOTCH_R + 2;
const OVERHANG = LIFT + KNOB / 2;

/**
 * The bar's top edge where the bite is: flat, easing up, around the circle,
 * then back down. Everything above that line is filled with the page's own
 * colour, which is what turns a straight-edged bar into a notched one.
 *
 * Built once. Only its position changes from tab to tab, so the shape is never
 * recomputed and moving it is a transform rather than a redraw.
 */
const CUT_PATH = [
  // Across the top, then down the right-hand side to the bar's edge.
  `M 0 0`,
  `L ${CUT_W} 0`,
  `L ${CUT_W} ${TOP_PAD}`,
  // Ease up from the flat edge to where the circle starts.
  `C ${CUT_W - FILLET * 0.4} ${TOP_PAD} ${CUT_W - FILLET * 0.6} ${MOUTH_Y} ${
    CUT_W - FILLET
  } ${MOUTH_Y}`,
  // Round the circle, right to left, passing underneath: clockwise on screen,
  // hence sweep 1, and under half a turn, hence large-arc 0.
  `A ${NOTCH_R} ${NOTCH_R} 0 0 1 ${FILLET} ${MOUTH_Y}`,
  // And back down to the flat edge on the left.
  `C ${FILLET * 0.6} ${MOUTH_Y} ${FILLET * 0.4} ${TOP_PAD} 0 ${TOP_PAD}`,
  `Z`,
].join(' ');

/**
 * The bottom navigation: a floating pill with a bite out of it, and the active
 * tab lifted into that bite.
 *
 * The lift does work that colour alone was doing before. Five near-identical
 * glyphs with one of them amber is a weak signal at a glance, and no signal at
 * all to anyone who cannot separate amber from grey; a circle that has left
 * the bar is neither. Weight and colour still change too, so there are three
 * cues where there was one.
 *
 * The bite is a shape in the page's colour laid over a plain rounded bar,
 * rather than a bar drawn with a notch in it. Same picture, and it means
 * changing tabs animates one transform on the native driver while the bar
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
        size: 24,
      })
    : null;

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
            <Svg width={CUT_W} height={CUT_H} style={styles.cut}>
              <Path d={CUT_PATH} fill={colors.background} />
            </Svg>
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
                    here as well would leave the active tab with no icon at all
                    for that frame. */}
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
  container: {backgroundColor: colors.background, paddingHorizontal: spacing.md},
  // Tall enough to hold the knob where it pokes out, so nothing has to draw
  // outside its parent - Android is unreliable about that. The screen above is
  // laid out below this whole height.
  barWrap: {height: OVERHANG + BAR_HEIGHT},
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BAR_HEIGHT,
    borderRadius: radii.lg + 8,
    backgroundColor: colors.surface,
  },
  floating: {position: 'absolute', left: 0, bottom: 0, height: BAR_HEIGHT, alignItems: 'center'},
  // Sits astride the bar's top edge, TOP_PAD of it above.
  cut: {position: 'absolute', top: -TOP_PAD},
  knob: {
    position: 'absolute',
    top: -(LIFT + KNOB / 2),
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.surfaceRaised,
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
