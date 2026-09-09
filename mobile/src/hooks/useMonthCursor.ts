import {useMemo, useState} from 'react';

/** A month a screen is currently looking at, plus prev/next navigation.
 * Shared by My Shifts and My Pay so "which month" works identically on both. */
export function useMonthCursor() {
  const [offset, setOffset] = useState(0);

  return useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
    const label = start.toLocaleDateString(undefined, {month: 'long', year: 'numeric'});

    return {
      start,
      end,
      label,
      isCurrentMonth: offset === 0,
      goPrevious: () => setOffset(current => current - 1),
      goNext: () => setOffset(current => current + 1),
    };
  }, [offset]);
}
