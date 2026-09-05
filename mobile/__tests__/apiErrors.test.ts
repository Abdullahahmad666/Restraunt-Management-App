import {AxiosError, AxiosHeaders} from 'axios';

import {describeApiError, isNetworkError} from '../src/api/errors';

function axiosError(opts: {status?: number; data?: unknown; code?: string}): AxiosError {
  const err = new AxiosError('boom', opts.code);
  if (opts.status !== undefined) {
    err.response = {
      status: opts.status,
      statusText: '',
      data: opts.data,
      headers: new AxiosHeaders(),
      config: {headers: new AxiosHeaders()},
    };
  }
  return err;
}

describe('describeApiError', () => {
  it('does NOT blame credentials when the server was unreachable', () => {
    // The whole reason this helper exists: a network failure used to surface as
    // "check your email and password", which sends debugging the wrong way.
    const message = describeApiError(axiosError({}));

    expect(message).toMatch(/cannot reach the server/i);
    expect(message).not.toMatch(/password/i);
  });

  it('names the address it tried, so a stale LAN IP is obvious', () => {
    expect(describeApiError(axiosError({}))).toContain('/api/v1');
  });

  it('blames credentials only on a real 401', () => {
    expect(describeApiError(axiosError({status: 401}))).toMatch(/do not match an account/i);
  });

  it('distinguishes a timeout from an unreachable server', () => {
    expect(describeApiError(axiosError({code: 'ECONNABORTED'}))).toMatch(/took too long/i);
  });

  it('reports a server fault as not the user fault', () => {
    expect(describeApiError(axiosError({status: 500}))).toMatch(/bug, not something you did/i);
  });

  it('calls out throttling separately', () => {
    expect(describeApiError(axiosError({status: 429}))).toMatch(/too many attempts/i);
  });

  it('surfaces a DRF detail message', () => {
    const message = describeApiError(axiosError({status: 400, data: {detail: 'Nope.'}}));
    expect(message).toBe('Nope.');
  });

  it('passes non_field_errors through without a field name', () => {
    // The unverified-email message arrives this way and reads as a sentence.
    const message = describeApiError(
      axiosError({
        status: 400,
        data: {non_field_errors: ['Please verify your email before logging in.']},
      }),
    );
    expect(message).toBe('Please verify your email before logging in.');
  });

  it('names the field for a field-level error', () => {
    // "This field is required." on a six-input form says nothing on its own.
    const message = describeApiError(
      axiosError({status: 400, data: {invite_code: ['This field is required.']}}),
    );
    expect(message).toBe('Invite code: This field is required.');
  });

  it('surfaces the first DRF field error', () => {
    const message = describeApiError(
      axiosError({status: 400, data: {email: ['Enter a valid email address.']}}),
    );
    expect(message).toBe('Email: Enter a valid email address.');
  });

  it('falls back for a non-axios throw', () => {
    expect(describeApiError(new Error('???'), 'Fallback.')).toBe('Fallback.');
  });
});

describe('isNetworkError', () => {
  it('is true with no response and false with one', () => {
    expect(isNetworkError(axiosError({}))).toBe(true);
    expect(isNetworkError(axiosError({status: 401}))).toBe(false);
    expect(isNetworkError(new Error('nope'))).toBe(false);
  });
});
