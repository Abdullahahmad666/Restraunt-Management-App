import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
import {ErrorState} from '../../../components/ErrorState';
import {FadeIn} from '../../../components/FadeIn';
import {LoadingView} from '../../../components/LoadingView';
import {MonthNav} from '../../../components/MonthNav';
import {Screen} from '../../../components/Screen';
import {TimePickerField} from '../../../components/TimePickerField';
import {describeApiError} from '../../../api/errors';
import {useCreateShift, useDeleteShift, useShifts} from '../../../features/attendance/hooks';
import {JOB_TITLE_LABELS, type JobTitle, type AdminShift} from '../../../features/attendance/types';
import {useRates} from '../../../features/payroll/hooks';
import {useStaffAccounts} from '../../../features/staff/hooks';
import type {StaffAccount} from '../../../features/staff/types';
import {useWeekCursor} from '../../../hooks/useWeekCursor';
import {colors, radii, spacing} from '../../../theme';
import {formatCurrency, formatHours, formatTime, fullName} from '../../../utils/format';

const JOB_TITLES = Object.keys(JOB_TITLE_LABELS) as JobTitle[];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function combineDayAndTime(day: Date, time: Date): Date {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    time.getHours(),
    time.getMinutes(),
    0,
    0,
  );
}

function shiftHours(shift: AdminShift): number {
  return (new Date(shift.ends_at).getTime() - new Date(shift.starts_at).getTime()) / 3_600_000;
}

/**
 * The weekly rota: who's working each day, Monday to Sunday, and what that
 * day is costing - built entirely on the existing Shift/StaffPayRate data,
 * just viewed a week at a time instead of person by person.
 *
 * Cost is an estimate at rate 1 for every hour - the real rate_1/rate_2
 * split is only decided when a pay period closes (see
 * apps.payroll.services.calculation), which knows actual hours worked, not
 * a rota that hasn't happened yet.
 */
export function RotaScreen(): React.JSX.Element {
  const week = useWeekCursor();
  const shifts = useShifts();
  const staff = useStaffAccounts();
  const rates = useRates();

  if (shifts.isLoading || staff.isLoading || rates.isLoading) {
    return <LoadingView />;
  }
  if (shifts.error || staff.error || rates.error) {
    return (
      <ErrorState
        message={describeApiError(
          shifts.error ?? staff.error ?? rates.error,
          'Could not load the rota.',
        )}
        onRetry={() => {
          shifts.refetch();
          staff.refetch();
          rates.refetch();
        }}
      />
    );
  }

  const activeStaff = (staff.data?.results ?? []).filter(member => member.is_active);
  const nameById = new Map(activeStaff.map(member => [member.id, fullName(member)]));
  const rate1ById = new Map(
    (rates.data?.results ?? []).map(rate => [rate.staff, Number(rate.rate_1)]),
  );

  function costOf(shift: AdminShift): number {
    return shiftHours(shift) * (rate1ById.get(shift.staff) ?? 0);
  }

  const weekShifts = (shifts.data?.results ?? []).filter(shift => {
    const starts = new Date(shift.starts_at);
    return starts >= week.start && starts <= week.end;
  });
  const weekCost = weekShifts.reduce((sum, shift) => sum + costOf(shift), 0);

  return (
    <Screen onRefresh={() => shifts.refetch()} refreshing={shifts.isRefetching}>
      <MonthNav label={week.label} onPrevious={week.goPrevious} onNext={week.goNext} />

      <Card style={styles.weekTotalCard}>
        <Text style={styles.weekTotalLabel}>Estimated staff cost this week</Text>
        <Text style={styles.weekTotalValue}>{formatCurrency(weekCost)}</Text>
      </Card>

      {week.days.map((day, index) => (
        <FadeIn key={day.toISOString()} delay={index * 40}>
          <DayCard
            day={day}
            shifts={weekShifts.filter(shift => isSameDay(new Date(shift.starts_at), day))}
            activeStaff={activeStaff}
            nameById={nameById}
            costOf={costOf}
          />
        </FadeIn>
      ))}
    </Screen>
  );
}

function DayCard({
  day,
  shifts,
  activeStaff,
  nameById,
  costOf,
}: {
  day: Date;
  shifts: AdminShift[];
  activeStaff: StaffAccount[];
  nameById: Map<string, string>;
  costOf: (shift: AdminShift) => number;
}): React.JSX.Element {
  const createShift = useCreateShift();
  const deleteShift = useDeleteShift();
  const [adding, setAdding] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(() => new Date(2000, 0, 1, 11, 0));
  const [endTime, setEndTime] = useState(() => new Date(2000, 0, 1, 23, 0));
  const [jobTitle, setJobTitle] = useState<JobTitle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dayCost = shifts.reduce((sum, shift) => sum + costOf(shift), 0);
  const sorted = [...shifts].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );

  async function onAdd() {
    setError(null);
    if (!selectedStaffId) {
      setError('Pick who is working.');
      return;
    }
    const starts = combineDayAndTime(day, startTime);
    let ends = combineDayAndTime(day, endTime);
    if (ends <= starts) {
      ends = new Date(ends.getTime() + 24 * 60 * 60 * 1000);
    }
    try {
      await createShift.mutateAsync({
        staff: selectedStaffId,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        job_title: jobTitle ?? '',
      });
      setAdding(false);
      setSelectedStaffId(null);
      setJobTitle(null);
    } catch (err) {
      setError(describeApiError(err, 'Could not add this shift.'));
    }
  }

  return (
    <Card>
      <View style={styles.dayHeader}>
        <Text style={styles.dayTitle}>
          {day.toLocaleDateString(undefined, {weekday: 'long', day: 'numeric', month: 'short'})}
        </Text>
        <Text style={styles.dayCost}>{formatCurrency(dayCost)}</Text>
      </View>

      {sorted.length === 0 ? (
        <Text style={styles.emptyDay}>Nobody scheduled yet.</Text>
      ) : (
        sorted.map(shift => (
          <View key={shift.id} style={styles.shiftRow}>
            <View>
              <Text style={styles.shiftName}>{nameById.get(shift.staff) ?? 'Staff member'}</Text>
              <Text style={styles.shiftTime}>
                {formatTime(shift.starts_at)} - {formatTime(shift.ends_at)} ·{' '}
                {formatHours(shiftHours(shift))}
                {shift.job_title ? ` · ${JOB_TITLE_LABELS[shift.job_title]}` : ''}
              </Text>
            </View>
            <View style={styles.shiftRight}>
              <Text style={styles.shiftCost}>{formatCurrency(costOf(shift))}</Text>
              <Pressable onPress={() => deleteShift.mutate(shift.id)} hitSlop={8}>
                <Text style={styles.removeLink}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      {adding ? (
        <View style={styles.addForm}>
          <Text style={styles.label}>Who's working</Text>
          <View style={styles.chipRow}>
            {activeStaff.map(member => {
              const selected = selectedStaffId === member.id;
              return (
                <Pressable
                  key={member.id}
                  onPress={() => setSelectedStaffId(member.id)}
                  style={[styles.chip, selected && styles.chipSelected]}>
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {fullName(member)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.timeRow}>
            <TimePickerField label="Start" value={startTime} onChange={setStartTime} />
            <TimePickerField label="End" value={endTime} onChange={setEndTime} />
          </View>

          <Text style={styles.label}>Job title (optional)</Text>
          <View style={styles.chipRow}>
            {JOB_TITLES.map(title => {
              const selected = jobTitle === title;
              return (
                <Pressable
                  key={title}
                  onPress={() => setJobTitle(current => (current === title ? null : title))}
                  style={[styles.chip, selected && styles.chipSelected]}>
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {JOB_TITLE_LABELS[title]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.formActions}>
            <Button title="Cancel" variant="secondary" onPress={() => setAdding(false)} />
            <Button title="Add to rota" onPress={onAdd} loading={createShift.isPending} />
          </View>
        </View>
      ) : (
        <Button title="+ Add staff" variant="secondary" onPress={() => setAdding(true)} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  weekTotalCard: {borderColor: colors.primary, borderWidth: 1, alignItems: 'center'},
  weekTotalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  weekTotalValue: {fontSize: 28, fontWeight: '700', color: colors.text},

  dayHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  dayTitle: {fontSize: 16, fontWeight: '700', color: colors.text},
  dayCost: {fontSize: 16, fontWeight: '700', color: colors.primary},
  emptyDay: {fontSize: 13, color: colors.textMuted, marginVertical: spacing.xs},

  shiftRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
  },
  shiftName: {fontSize: 14, fontWeight: '600', color: colors.text},
  shiftTime: {fontSize: 12, color: colors.textMuted},
  shiftRight: {alignItems: 'flex-end', gap: 2},
  shiftCost: {fontSize: 13, fontWeight: '600', color: colors.text},
  removeLink: {fontSize: 12, color: colors.danger, fontWeight: '600'},

  addForm: {gap: spacing.sm, marginTop: spacing.sm},
  label: {fontSize: 13, fontWeight: '600', color: colors.textMuted},
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipSelected: {backgroundColor: colors.primary, borderColor: colors.primary},
  chipText: {fontSize: 13, color: colors.text},
  chipTextSelected: {color: '#FFFFFF', fontWeight: '700'},
  timeRow: {flexDirection: 'row', gap: spacing.md},
  formActions: {flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end'},
  error: {color: colors.danger, fontSize: 12},
});
