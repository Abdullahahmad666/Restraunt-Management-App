import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import Svg, {Circle, Line, Polyline} from 'react-native-svg';

import {colors, spacing} from '../theme';

export type LinePoint = {
  label: string;
  value: number;
};

const POINT_GAP = 56;
const CHART_HEIGHT = 140;
const PADDING_TOP = 16;
const BASELINE_Y = CHART_HEIGHT - 20;

/**
 * A single-series line chart, hand-rolled on react-native-svg (see BarChart
 * for why: this app already ships the library, and one line is one
 * polyline plus a circle per point). For a month-by-month trend, not a
 * day-by-day one - few enough points that a line reads as a trend rather
 * than noise.
 */
export function LineChart({
  data,
  lineColor,
  valueFormatter,
  emptyLabel = 'Not enough history yet.',
}: {
  data: LinePoint[];
  lineColor: string;
  valueFormatter: (value: number) => string;
  emptyLabel?: string;
}): React.JSX.Element {
  const [selected, setSelected] = useState<number | null>(null);

  if (data.length === 0) {
    return <Text style={styles.empty}>{emptyLabel}</Text>;
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const chartWidth = Math.max(data.length * POINT_GAP, POINT_GAP);
  const selectedDatum = selected !== null ? data[selected] : undefined;

  const points = data.map((datum, index) => {
    const x = POINT_GAP / 2 + index * POINT_GAP;
    const y = BASELINE_Y - (datum.value / maxValue) * (BASELINE_Y - PADDING_TOP);
    return {x, y, datum};
  });
  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <View>
      <Text style={styles.tooltip}>
        {selectedDatum
          ? `${selectedDatum.label}: ${valueFormatter(selectedDatum.value)}`
          : 'Tap a point for its value'}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <Svg width={chartWidth} height={CHART_HEIGHT}>
            <Line
              x1={0}
              y1={BASELINE_Y}
              x2={chartWidth}
              y2={BASELINE_Y}
              stroke={colors.border}
              strokeWidth={1}
            />
            <Polyline
              points={polylinePoints}
              fill="none"
              stroke={lineColor}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((point, index) => (
              <Circle
                key={index}
                cx={point.x}
                cy={point.y}
                r={selected === index ? 6 : 4}
                fill={selected === index ? colors.text : lineColor}
              />
            ))}
          </Svg>
          <View style={[styles.touchRow, {width: chartWidth}]}>
            {data.map((_, index) => (
              <Pressable
                key={index}
                style={styles.touchTarget}
                onPress={() => setSelected(current => (current === index ? null : index))}
              />
            ))}
          </View>
          <View style={[styles.labelRow, {width: chartWidth}]}>
            {data.map((datum, index) => (
              <Text key={index} style={styles.label} numberOfLines={1}>
                {datum.label}
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {fontSize: 13, color: colors.textMuted, textAlign: 'center', padding: spacing.lg},
  tooltip: {fontSize: 13, color: colors.textMuted, marginBottom: spacing.xs, minHeight: 18},
  touchRow: {flexDirection: 'row', position: 'absolute', top: 0, height: CHART_HEIGHT},
  touchTarget: {width: POINT_GAP},
  labelRow: {flexDirection: 'row'},
  label: {width: POINT_GAP, fontSize: 10, color: colors.textMuted, textAlign: 'center'},
});
