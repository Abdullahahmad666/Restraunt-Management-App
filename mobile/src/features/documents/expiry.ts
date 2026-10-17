/**
 * Whether a document is still worth producing.
 *
 * The point of the feature is handing a phone to somebody official, and the
 * only thing worse than not finding a certificate is finding one that ran out
 * in March. So "expired" is computed in one place and said the same way on
 * every screen.
 */
import type {ComplianceDocument} from './types';

/** How far ahead counts as "soon". A month is long enough to renew a hygiene
 * certificate or an insurance policy without rushing, and short enough that
 * the warning still means something when it appears. */
export const EXPIRING_SOON_DAYS = 30;

export type ExpiryStatus = 'none' | 'expired' | 'soon' | 'valid';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight today, in the phone's own calendar. A document that expires today
 * is still valid today - it runs out at the end of the day, not at the moment
 * somebody happens to look. */
function startOfToday(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/** A `YYYY-MM-DD` as local midnight.
 *
 * Built from its parts rather than parsed: `new Date("2026-10-17")` is read as
 * UTC, which is the previous evening anywhere west of it, and that is how a
 * certificate expires a day early for half the world.
 */
function parseDate(value: string): number {
  const [year = 1970, month = 1, day = 1] = value.split('-').map(Number);
  return new Date(year, month - 1, day).getTime();
}

/**
 * Whole days from today until it runs out: 0 on the day itself, 1 tomorrow,
 * negative once it has passed.
 *
 * Both sides are local midnight, so this is a difference between two days
 * rather than between two moments - the answer does not change depending on
 * whether somebody looks in the morning or the evening.
 */
export function daysUntilExpiry(expiresOn: string, now: Date = new Date()): number {
  return Math.round((parseDate(expiresOn) - startOfToday(now)) / DAY_MS);
}

export function expiryStatus(expiresOn: string | null, now: Date = new Date()): ExpiryStatus {
  if (!expiresOn) {
    return 'none';
  }
  const days = daysUntilExpiry(expiresOn, now);
  if (days < 0) {
    return 'expired';
  }
  return days <= EXPIRING_SOON_DAYS ? 'soon' : 'valid';
}

/** What to put under a document's title. */
export function describeExpiry(expiresOn: string | null, now: Date = new Date()): string | null {
  const status = expiryStatus(expiresOn, now);
  if (status === 'none' || !expiresOn) {
    return null;
  }
  if (status === 'expired') {
    return 'Expired';
  }
  const days = daysUntilExpiry(expiresOn, now);
  if (status === 'soon') {
    return days === 0 ? 'Expires today' : `Expires in ${days} day${days === 1 ? '' : 's'}`;
  }
  return 'Valid';
}

/**
 * What the Checks dashboard puts under "Documents".
 *
 * Says the worst thing first. A manager glancing at that screen needs to know
 * a certificate has lapsed; how many are filed in total is only interesting
 * when nothing is wrong.
 */
export function summariseDocuments(
  documents: ComplianceDocument[],
  now: Date = new Date(),
): {subtitle: string; tone: 'danger' | 'warning' | undefined} {
  if (documents.length === 0) {
    return {subtitle: 'Nothing filed yet', tone: undefined};
  }

  const statuses = documents.map(document => expiryStatus(document.expires_on, now));
  const expired = statuses.filter(status => status === 'expired').length;
  if (expired > 0) {
    return {subtitle: `${expired} expired`, tone: 'danger'};
  }

  const soon = statuses.filter(status => status === 'soon').length;
  if (soon > 0) {
    return {subtitle: `${soon} expiring soon`, tone: 'warning'};
  }

  return {subtitle: `${documents.length} filed`, tone: undefined};
}
