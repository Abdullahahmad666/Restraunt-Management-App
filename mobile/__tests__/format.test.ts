import {formatDate, formatDateTime, formatTime} from '../src/utils/format';

/**
 * These are pinned to en-GB on purpose - the restaurant is UK-only, and a
 * phone set to US English would otherwise print "Oct 3, 2026" and "7:05 PM"
 * for the same shift.
 */
describe('dates a user reads', () => {
  it('prints a plain date as the day it says, not the day before', () => {
    // The trap: "2026-10-03" parsed in a zone west of UTC becomes the evening
    // of the 2nd. Pay periods and invoice dates are plain dates, and a payslip
    // headed with the wrong week is not a rounding error.
    expect(formatDate('2026-10-03')).toBe('3 Oct 2026');
    expect(formatDate('2026-01-01')).toBe('1 Jan 2026');
  });

  it('accepts a timestamp rather than answering "Invalid Date"', () => {
    // It used to append "T00:00:00Z" to whatever it was handed, so a timestamp
    // came out as "...ZT00:00:00Z" and rendered as Invalid Date on the screen -
    // no throw, no log, no clue which field was wrong.
    expect(formatDate('2026-10-03T19:05:00Z')).not.toMatch(/invalid/i);
    expect(formatDate('2026-10-03T19:05:00Z')).toMatch(/Oct 2026$/);
  });

  it('keeps the time on a timestamp when one is asked for', () => {
    expect(formatDateTime('2026-10-03T19:05:00Z')).toMatch(/Oct 2026/);
    expect(formatTime('2026-10-03T19:05:00Z')).toMatch(/^\d{2}:\d{2}$/);
  });
});
