import {useMemo, useState} from 'react';

/** The week (Monday-Sunday) a screen is currently looking at, plus
 * prev/next navigation - the weekly-rota equivalent of useMonthCursor. */
export function useWeekCursor() {
  const [offset, setOffset] = useState(0);

  return useMemo(() => {
    const now = new Date();
    // getDay(): 0 = Sunday .. 6 = Saturday. Distance back to this week's
    // Monday, treating Sunday as day 7 so it doesn't count as "0 days back".
    const isoDay = now.getDay() === 0 ? 7 : now.getDay();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (isoDay - 1));
    monday.setDate(monday.getDate() + offset * 7);

    const days = Array.from(
      {length: 7},
      (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i),
    );
    const sunday = days[6] as Date;

    const label = `${monday.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    })} - ${sunday.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`;

    return {
      days,
      start: monday,
      end: new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 23, 59, 59, 999),
      label,
      isCurrentWeek: offset === 0,
      goPrevious: () => setOffset(current => current - 1),
      goNext: () => setOffset(current => current + 1),
    };
  }, [offset]);
}
