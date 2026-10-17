import {
  daysUntilExpiry,
  describeExpiry,
  expiryStatus,
  summariseDocuments,
} from '../src/features/documents/expiry';
import type {ComplianceDocument} from '../src/features/documents/types';

/** Mid-afternoon, so nothing here passes by accident on a timezone boundary. */
const NOW = new Date(2026, 9, 17, 15, 30);

function document(expires_on: string | null): ComplianceDocument {
  return {
    id: expires_on ?? 'none',
    category: null,
    category_name: null,
    title: 'Food hygiene certificate',
    file: 'https://example.test/x.jpg',
    content_type: 'image/jpeg',
    is_image: true,
    notes: '',
    expires_on,
    uploaded_by_name: null,
    created_at: '2026-10-01T09:00:00Z',
  };
}

describe('whether a document is still worth producing', () => {
  it('counts a certificate expiring today as valid today', () => {
    // It runs out at the end of the day, not at the moment somebody looks -
    // and an inspector arriving at 3pm is looking on a day it still covers.
    expect(expiryStatus('2026-10-17', NOW)).toBe('soon');
    expect(describeExpiry('2026-10-17', NOW)).toBe('Expires today');
  });

  it('counts yesterday as expired', () => {
    expect(expiryStatus('2026-10-16', NOW)).toBe('expired');
    expect(describeExpiry('2026-10-16', NOW)).toBe('Expired');
  });

  it('warns a month ahead and no further', () => {
    expect(expiryStatus('2026-11-16', NOW)).toBe('soon');
    expect(expiryStatus('2026-11-17', NOW)).toBe('valid');
  });

  it('treats no date as no date, not as expired', () => {
    // Plenty of paperwork never runs out. Reading a missing date as a lapsed
    // one would put a red flag on a company registration forever.
    expect(expiryStatus(null, NOW)).toBe('none');
    expect(describeExpiry(null, NOW)).toBeNull();
  });

  it('counts whole days, whatever time of day it is asked', () => {
    // Today is zero, tomorrow is one, and an afternoon does not round a day
    // away - the two sides are both midnight rather than both moments.
    expect(daysUntilExpiry('2026-10-17', NOW)).toBe(0);
    expect(daysUntilExpiry('2026-10-18', NOW)).toBe(1);
    expect(daysUntilExpiry('2026-10-20', NOW)).toBe(3);
    expect(daysUntilExpiry('2026-10-15', NOW)).toBe(-2);

    const morning = new Date(2026, 9, 17, 7, 0);
    const lateEvening = new Date(2026, 9, 17, 23, 45);
    expect(daysUntilExpiry('2026-10-18', morning)).toBe(1);
    expect(daysUntilExpiry('2026-10-18', lateEvening)).toBe(1);
  });
});

describe('what the dashboard says', () => {
  it('leads with what has lapsed', () => {
    const summary = summariseDocuments(
      [document('2026-10-01'), document('2026-10-20'), document(null)],
      NOW,
    );

    expect(summary).toEqual({subtitle: '1 expired', tone: 'danger'});
  });

  it('mentions what is about to, when nothing has yet', () => {
    const summary = summariseDocuments([document('2026-10-20'), document(null)], NOW);

    expect(summary).toEqual({subtitle: '1 expiring soon', tone: 'warning'});
  });

  it('counts them when all is well', () => {
    const summary = summariseDocuments([document('2027-01-01'), document(null)], NOW);

    expect(summary).toEqual({subtitle: '2 filed', tone: undefined});
  });

  it('says so when there is nothing at all', () => {
    expect(summariseDocuments([], NOW)).toEqual({subtitle: 'Nothing filed yet', tone: undefined});
  });
});
