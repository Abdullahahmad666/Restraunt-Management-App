import React, {useMemo, useRef} from 'react';
import {PanResponder, StyleSheet, View} from 'react-native';
import Svg, {Circle, Line, Path, Text as SvgText} from 'react-native-svg';

import {colors} from '../theme';

const RADIUS = 108;
const STROKE = 14;
const PADDING = 24;
const SVG_WIDTH = RADIUS * 2 + PADDING * 2;
const SVG_HEIGHT = RADIUS + PADDING * 2;
const CENTER_X = SVG_WIDTH / 2;
const CENTER_Y = SVG_HEIGHT - PADDING;

function angleForValue(value: number, min: number, max: number): number {
  const ratio = (value - min) / (max - min);
  return 180 - ratio * 180;
}

function pointOnArc(angleDeg: number, radius: number) {
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER_X + radius * Math.cos(angleRad),
    y: CENTER_Y - radius * Math.sin(angleRad),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

type Props = {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  /** Values at or above this render the arc/thumb in the danger colour -
   * e.g. a fridge's recommended maximum. */
  dangerAbove?: number;
};

/**
 * A drag-to-set semicircular gauge, min at the left end sweeping clockwise
 * over the top to max at the right - the same shape as a car speedometer.
 * Built on react-native-svg (already a dependency, for the QR code screen)
 * and core PanResponder rather than a gesture library, since neither
 * gesture-handler nor reanimated is otherwise used in this app.
 */
export function TemperatureGauge({
  min,
  max,
  step = 0.5,
  value,
  onChange,
  dangerAbove,
}: Props): React.JSX.Element {
  const latestOnChange = useRef(onChange);
  latestOnChange.current = onChange;

  const angle = angleForValue(clamp(value, min, max), min, max);
  const thumb = pointOnArc(angle, RADIUS);
  const inDanger = dangerAbove !== undefined && value > dangerAbove;
  const activeColor = inDanger ? colors.danger : colors.primary;

  const progressPath = useMemo(() => {
    const start = pointOnArc(180, RADIUS);
    const end = pointOnArc(angle, RADIUS);
    const largeArc = 180 - angle > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  }, [angle]);

  const trackPath = useMemo(() => {
    const start = pointOnArc(180, RADIUS);
    const end = pointOnArc(0, RADIUS);
    return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 1 1 ${end.x} ${end.y}`;
  }, []);

  function valueFromTouch(locationX: number, locationY: number) {
    const dx = locationX - CENTER_X;
    const dy = locationY - CENTER_Y;
    let angleDeg = (Math.atan2(-dy, dx) * 180) / Math.PI;
    if (angleDeg < 0) {
      angleDeg = dx >= 0 ? 0 : 180;
    }
    angleDeg = clamp(angleDeg, 0, 180);
    const ratio = (180 - angleDeg) / 180;
    const raw = min + ratio * (max - min);
    const stepped = Math.round(raw / step) * step;
    latestOnChange.current(clamp(Math.round(stepped * 10) / 10, min, max));
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: event => {
        valueFromTouch(event.nativeEvent.locationX, event.nativeEvent.locationY);
      },
      onPanResponderMove: event => {
        valueFromTouch(event.nativeEvent.locationX, event.nativeEvent.locationY);
      },
    }),
  ).current;

  const majorStep = (max - min) / 5;
  const minorStep = majorStep / 4;
  const ticks: Array<{value: number; major: boolean}> = [];
  for (let t = min; t <= max + 0.001; t += minorStep) {
    const stepsFromMin = Math.round((t - min) / majorStep);
    const major = Math.abs(t - min - stepsFromMin * majorStep) < 0.01;
    ticks.push({value: Math.round(t * 10) / 10, major});
  }

  return (
    <View style={styles.wrap} {...panResponder.panHandlers}>
      <Svg width={SVG_WIDTH} height={SVG_HEIGHT}>
        <Path
          d={trackPath}
          stroke={colors.surfaceRaised}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d={progressPath}
          stroke={activeColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
        />
        {ticks.map(tick => {
          const tickAngle = angleForValue(tick.value, min, max);
          const outer = pointOnArc(tickAngle, RADIUS + STROKE / 2 + 4);
          const inner = pointOnArc(tickAngle, RADIUS + STROKE / 2 + (tick.major ? 12 : 7));
          return (
            <Line
              key={tick.value}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke={colors.border}
              strokeWidth={tick.major ? 2 : 1}
            />
          );
        })}
        {ticks
          .filter(tick => tick.major)
          .map(tick => {
            const tickAngle = angleForValue(tick.value, min, max);
            const labelPoint = pointOnArc(tickAngle, RADIUS + STROKE / 2 + 24);
            return (
              <SvgText
                key={`label-${tick.value}`}
                x={labelPoint.x}
                y={labelPoint.y}
                fontSize={11}
                fill={colors.textMuted}
                textAnchor="middle">
                {tick.value}°
              </SvgText>
            );
          })}
        <Circle
          cx={thumb.x}
          cy={thumb.y}
          r={12}
          fill={activeColor}
          stroke={colors.background}
          strokeWidth={3}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {width: SVG_WIDTH, height: SVG_HEIGHT, alignSelf: 'center'},
});
