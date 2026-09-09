import React, {useState} from 'react';
import {Platform, Pressable, StyleSheet, Text, View} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import {colors, radii, spacing} from '../theme';

function formatTimeOfDay(date: Date): string {
  return date.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'});
}

/** A labelled button that opens the native time picker - shared by every
 * shift-time form (add shift, the weekly rota) so they all pick times the
 * same way. */
export function TimePickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.button} onPress={() => setOpen(true)} accessibilityRole="button">
        <Text style={styles.buttonText}>{formatTimeOfDay(value)}</Text>
      </Pressable>

      {open ? (
        <DateTimePicker
          value={value}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            if (Platform.OS === 'android') {
              setOpen(false);
            }
            if (event.type !== 'dismissed' && date) {
              onChange(date);
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
  field: {flex: 1, gap: spacing.xs},
  label: {fontSize: 13, fontWeight: '600', color: colors.textMuted},
  button: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  buttonText: {fontSize: 16, color: colors.text, fontWeight: '600'},
  done: {fontSize: 13, color: colors.primary, fontWeight: '700', textAlign: 'center'},
});
