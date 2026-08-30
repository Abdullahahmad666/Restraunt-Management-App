/** Shared display formatting so screens don't each invent their own. */

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {timeStyle: 'short'});
}

export function formatDate(isoDate: string): string {
  // isoDate is a plain "YYYY-MM-DD" - parsing as UTC avoids the date shifting
  // by a day for anyone west of UTC.
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(undefined, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });
}

export function formatCurrency(amount: string | number): string {
  return `£${Number(amount).toFixed(2)}`;
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
