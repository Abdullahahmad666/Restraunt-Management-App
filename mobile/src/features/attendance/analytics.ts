/** Turns logs + shifts into punctuality figures - shared by the staff and
 * admin analytics screens so "late" means exactly the same thing on both. */
import type {AttendanceLog, Shift} from './types';

export type LatenessSummary = {
  /** One entry per closed, shift-matched log in the window, oldest first. */
  daily: {label: string; lateMinutes: number}[];
  totalLateMinutes: number;
  onTimeCount: number;
  lateCount: number;
};

/** A log counts as late past this many minutes - a minute of clock drift
 * between two phones isn't worth flagging, same threshold the "X min late"
 * badge on Scan History already uses. */
const LATE_THRESHOLD_MINUTES = 1;

export function computeLateness(
  logs: AttendanceLog[],
  shifts: Shift[],
  window: {start: Date; end: Date},
): LatenessSummary {
  const shiftById = new Map(shifts.map(shift => [shift.id, shift]));

  const matched = logs
    .filter(log => log.shift && log.clock_out_at)
    .map(log => ({log, shift: shiftById.get(log.shift as string)}))
    .filter(
      (entry): entry is {log: AttendanceLog; shift: Shift} =>
        entry.shift !== undefined &&
        new Date(entry.log.clock_in_at) >= window.start &&
        new Date(entry.log.clock_in_at) <= window.end,
    )
    .sort((a, b) => new Date(a.log.clock_in_at).getTime() - new Date(b.log.clock_in_at).getTime());

  let totalLateMinutes = 0;
  let onTimeCount = 0;
  let lateCount = 0;

  const daily = matched.map(({log, shift}) => {
    const clockIn = new Date(log.clock_in_at);
    const lateMs = clockIn.getTime() - new Date(shift.starts_at).getTime();
    const lateMinutes = lateMs > LATE_THRESHOLD_MINUTES * 60_000 ? Math.round(lateMs / 60_000) : 0;

    if (lateMinutes > 0) {
      lateCount += 1;
      totalLateMinutes += lateMinutes;
    } else {
      onTimeCount += 1;
    }

    return {
      label: clockIn.toLocaleDateString(undefined, {day: 'numeric', month: 'short'}),
      lateMinutes,
    };
  });

  return {daily, totalLateMinutes, onTimeCount, lateCount};
}
