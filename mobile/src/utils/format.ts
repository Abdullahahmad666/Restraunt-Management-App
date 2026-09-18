/** Shared display formatting so screens don't each invent their own.
 *
 * The restaurant is UK-only (see render.yaml's TIME_ZONE comment), so every
 * date/time/currency format here is pinned to 'en-GB'/GBP rather than left
 * to `undefined` (the device's own locale) - a phone set to US English
 * would otherwise show "Sep 18, 2026" and "1:35 PM" instead of "18 Sep
 * 2026" and "13:35" for the exact same restaurant. Screens outside this
 * file that call toLocaleDateString/toLocaleTimeString directly should
 * import LOCALE from here rather than passing `undefined`.
 */

export const LOCALE = 'en-GB';
const CURRENCY = 'GBP';

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, {timeStyle: 'short'});
}

export function formatDate(isoDate: string): string {
  // isoDate is a plain "YYYY-MM-DD" - parsing as UTC avoids the date shifting
  // by a day for anyone west of UTC.
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(LOCALE, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });
}

export function formatCurrency(amount: string | number): string {
  return new Intl.NumberFormat(LOCALE, {style: 'currency', currency: CURRENCY}).format(
    Number(amount),
  );
}

export function formatHours(hours: string | number): string {
  return `${Number(hours).toFixed(2)}h`;
}

/** "2h 14m" between an ISO timestamp and now - for a live "on shift" duration. */
export function formatElapsed(sinceIso: string): string {
  const ms = Date.now() - new Date(sinceIso).getTime();
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function fullName(person: {first_name: string; last_name: string}): string {
  return `${person.first_name} ${person.last_name}`.trim();
}
