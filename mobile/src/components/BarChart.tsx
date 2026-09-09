import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import Svg, {Line, Rect} from 'react-native-svg';

import {colors, radii, spacing} from '../theme';

export type BarDatum = {
  label: string;
  value: number;
};

const BAR_WIDTH = 18;
const BAR_GAP = 10;
const CHART_HEIGHT = 140;

/**
 * A plain bar chart, hand-rolled on react-native-svg rather than pulling in
 * a charting library - this app already ships react-native-svg for the QR
 * code, and a single-series bar chart is a handful of rects.
 *
 * Tap a bar for its exact value (a touch device's answer to a hover
 * tooltip) - one bar at a time, shown above the chart rather than a
 * floating callout that would spill off the edge of the screen.
 */
export function BarChart({
  data,
  barColor,
  unit = '',
  emptyLabel = 'Nothing to show yet.',
  showAllLabels = false,
  valueFormatter,
}: {
  data: BarDatum[];
  barColor: string;
  unit?: string;
  emptyLabel?: string;
  /** Show every bar's label, not just every other one. The default (skip
   * alternates) suits ~30 day-of-month labels; a short list of staff names
   * should all be readable at once. */
  showAllLabels?: boolean;
  /** How the tooltip renders a value - defaults to "12.3" + unit. Pass this
   * for anything that isn't a bare number with a suffix, e.g. currency. */
  valueFormatter?: (value: number) => string;
}): React.JSX.Element {
  const [selected, setSelected] = useState<number | null>(null);

  if (data.length === 0) {
    return <Text style={styles.empty}>{emptyLabel}</Text>;
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const chartWidth = data.length * (BAR_WIDTH + BAR_GAP) + BAR_GAP;
  const selectedDatum = selected !== null ? data[selected] : undefined;
  const formatValue = valueFormatter ?? ((value: number) => `${value.toFixed(1)}${unit}`);

  return (
    <View>
      <Text style={styles.tooltip}>
        {selectedDatum
          ? `${selectedDatum.label}: ${formatValue(selectedDatum.value)}`
          : 'Tap a bar for its value'}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={chartWidth} height={CHART_HEIGHT}>
          {/* Baseline - the recessive axis line marks are measured from. */}
          <Line
            x1={0}
            y1={CHART_HEIGHT - 20}
            x2={chartWidth}
            y2={CHART_HEIGHT - 20}
            stroke={colors.border}
            strokeWidth={1}
          />
          {data.map((datum, index) => {
            const barHeight = Math.max((datum.value / maxValue) * (CHART_HEIGHT - 32), 2);
            const x = BAR_GAP + index * (BAR_WIDTH + BAR_GAP);
            const y = CHART_HEIGHT - 20 - barHeight;
            return (
              <Rect
                key={index}
                x={x}
                y={y}
                width={BAR_WIDTH}
                height={barHeight}
                rx={4}
                fill={selected === index ? colors.text : barColor}
                opacity={selected === null || selected === index ? 1 : 0.55}
              />
            );
          })}
        </Svg>
        {/* A row of transparent touch targets over the bars - taller than
            the bars themselves so a short (or zero) bar is still easy to
            tap, per the "hit target bigger than the mark" rule. */}
        <View style={[styles.touchRow, {width: chartWidth}]}>
          {data.map((_, index) => (
            <Pressable
              key={index}
              style={styles.touchTarget}
              onPress={() => setSelected(current => (current === index ? null : index))}
            />
          ))}
        </View>
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={[styles.labelRow, {width: chartWidth}]}>
          {data.map((datum, index) => (
            <Text key={index} style={styles.label} numberOfLines={1}>
              {showAllLabels || index % 2 === 0 ? datum.label : ''}
            </Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {fontSize: 13, color: colors.textMuted, textAlign: 'center', padding: spacing.lg},
  tooltip: {fontSize: 13, color: colors.textMuted, marginBottom: spacing.xs, minHeight: 18},
  touchRow: {
    flexDirection: 'row',
    position: 'absolute',
    top: 0,
    height: CHART_HEIGHT,
  },
  touchTarget: {width: BAR_WIDTH + BAR_GAP},
  labelRow: {flexDirection: 'row'},
  label: {
    width: BAR_WIDTH + BAR_GAP,
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

/** A single two-segment horizontal bar - on time vs late, this month. Not a
 * pie chart on purpose: two categories read faster as one segmented bar
 * than as wedges, and it survives being 40px tall in a card. */
export function SplitBar({
  goodCount,
  poorCount,
  goodLabel,
  poorLabel,
}: {
  goodCount: number;
  poorCount: number;
  goodLabel: string;
  poorLabel: string;
}): React.JSX.Element {
  const total = goodCount + poorCount;
  const goodPct = total === 0 ? 0 : (goodCount / total) * 100;

  return (
    <View>
      <View style={splitStyles.track}>
        {total === 0 ? null : (
          <>
            <View
              style={[
                splitStyles.segment,
                {flex: goodCount || 0.0001, backgroundColor: colors.success},
              ]}
            />
            <View
              style={[
                splitStyles.segment,
                {flex: poorCount || 0.0001, backgroundColor: colors.warning},
              ]}
            />
          </>
        )}
      </View>
      <View style={splitStyles.legendRow}>
        <View style={splitStyles.legendItem}>
          <View style={[splitStyles.dot, {backgroundColor: colors.success}]} />
          <Text style={splitStyles.legendText}>
            {goodLabel}: {goodCount} ({goodPct.toFixed(0)}%)
          </Text>
        </View>
        <View style={splitStyles.legendItem}>
          <View style={[splitStyles.dot, {backgroundColor: colors.warning}]} />
          <Text style={splitStyles.legendText}>
            {poorLabel}: {poorCount}
          </Text>
        </View>
      </View>
    </View>
  );
}

const splitStyles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    height: 14,
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  segment: {height: '100%'},
  legendRow: {flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs},
  legendItem: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  dot: {width: 8, height: 8, borderRadius: 4},
  legendText: {fontSize: 12, color: colors.textMuted},
});
