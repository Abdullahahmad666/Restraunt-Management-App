import {isScanInProgress} from '../src/features/inventory/types';
import {AVATAR, EQUIPMENT_PHOTO, INVOICE, mimeTypeForUri} from '../src/utils/media';

describe('mimeTypeForUri', () => {
  it('recognises the types an invoice can arrive as', () => {
    expect(mimeTypeForUri('file:///tmp/invoice.pdf')).toBe('application/pdf');
    expect(mimeTypeForUri('file:///tmp/invoice.png')).toBe('image/png');
    expect(mimeTypeForUri('file:///tmp/invoice.webp')).toBe('image/webp');
    expect(mimeTypeForUri('file:///tmp/invoice.jpg')).toBe('image/jpeg');
  });

  it('ignores a query string, which every signed S3 url has', () => {
    expect(mimeTypeForUri('https://bucket.s3.amazonaws.com/x/y.pdf?X-Amz-Signature=abc')).toBe(
      'application/pdf',
    );
  });

  it('falls back to jpeg rather than refusing an unknown extension', () => {
    expect(mimeTypeForUri('file:///tmp/photo')).toBe('image/jpeg');
  });
});

describe('compression profiles', () => {
  it('keeps invoices the largest and least compressed', () => {
    // An invoice is read character by character; an avatar never is. Squeezing
    // them the same way is what turns "1.25" into something no reader can
    // recover, so this ordering is the point of having profiles at all.
    expect(INVOICE.maxDimension).toBeGreaterThan(EQUIPMENT_PHOTO.maxDimension);
    expect(EQUIPMENT_PHOTO.maxDimension).toBeGreaterThan(AVATAR.maxDimension);
    expect(INVOICE.quality).toBeGreaterThan(AVATAR.quality);
  });

  it('caps invoices at the size the reader actually uses', () => {
    // Anything larger is downsampled before it is read, so the extra pixels
    // cost upload time and storage and buy nothing.
    expect(INVOICE.maxDimension).toBe(1568);
  });
});

describe('isScanInProgress', () => {
  it('is true while the worker still owes us line items', () => {
    expect(isScanInProgress('AWAITING_UPLOAD')).toBe(true);
    expect(isScanInProgress('QUEUED')).toBe(true);
    expect(isScanInProgress('SCANNING')).toBe(true);
  });

  it('is false once there is an answer, including a bad one', () => {
    // FAILED has to end the wait as much as DONE does - the review screen
    // polls on this, and a spinner nobody ever stops is worse than an error.
    expect(isScanInProgress('DONE')).toBe(false);
    expect(isScanInProgress('FAILED')).toBe(false);
  });
});
