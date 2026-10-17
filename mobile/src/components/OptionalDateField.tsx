import React, {useState} from 'react';
import {Platform, Pressable, StyleSheet, Text, View} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {Ionicons} from '@expo/vector-icons';

import {PressableScale} from './PressableScale';
import {colors, radii, spacing} from '../theme';
import {formatDate} from '../utils/format';

/** Today, with the time thrown away - what a date field is actually choosing. */
function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** `YYYY-MM-DD` in the phone's own calendar, which is what the API stores.
 * Deliberately not toISOString(): that converts to UTC first, so an evening in
 * British Summer Time comes out as the following day. */
function asApiDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

type Props = {
  label: string;
  /** `YYYY-MM-DD`, or null for "no date" - which is a real answer here, not a
   * missing one. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** What to call the empty state, in the words of whatever is being dated. */
  emptyLabel?: string;
};

/**
 * A date that may legitimately not exist.
 *
 * Most paperwork expires and some never does - a food hygiene certificate has
 * a date on it, a company registration does not. So "none" is a first-class
 * answer rather than an empty box somebody is expected to leave alone, and
 * clearing it is one tap rather than a trick.
 */
export function OptionalDateField({
  label,
  value,
  onChange,
  emptyLabel = 'No date',
}: Props): React.JSX.Element {
  const [open, setOpen] = useState(false);

  // Parsed as local midday rather than midnight: a date-only string is read as
  // UTC, and midnight UTC is the previous evening anywhere west of it, which
  // is how a picker ends up opening on the wrong day.
  const current = value ? new Date(`${value}T12:00:00`) : startOfToday();

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.row}>
        <PressableScale
          style={styles.button}
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={value ? `${label}: ${formatDate(value)}. Change` : `Set ${label}`}>
          <Ionicons
            name="calendar-outline"
            size={16}
            color={value ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.buttonText, !value && styles.buttonTextEmpty]}>
            {value ? formatDate(value) : emptyLabel}
          </Text>
        </PressableScale>

        {value ? (
          <PressableScale
            onPress={() => onChange(null)}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
            style={styles.clear}>
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </PressableScale>
        ) : null}
      </View>

      {open ? (
        <DateTimePicker
          value={current}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            if (Platform.OS === 'android') {
              setOpen(false);
            }
            if (event.type !== 'dismissed' && date) {
              onChange(asApiDate(date));
            }
          }}
        />
      ) : null}
      {open && Platform.OS === 'ios' ? (
        <Pressable onPress={() => setOpen(false)} hitSlop={8}>
          <Text style={styles.done}>Done</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {gap: spacing.xs},
  label: {fontSize: 13, color: colors.textMuted},
  row: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  buttonText: {fontSize: 15, color: colors.text},
  buttonTextEmpty: {color: colors.textMuted},
  clear: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  done: {fontSize: 13, color: colors.primary, fontWeight: '600', alignSelf: 'flex-end'},
});
