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

    expect(message).toMatch(/no connection/i);
    expect(message).not.toMatch(/password/i);
  });

  it('keeps the address it tried out of what a user reads', () => {
    // It used to be named here, which is genuinely the fastest way to spot a
    // stale LAN IP - and meaningless to a manager in a kitchen, who reads an
    // internal address as the app being broken rather than the wifi being out.
    // It goes to the console instead, where whoever needs it is looking.
    const message = describeApiError(axiosError({}));

    expect(message).not.toContain('/api/v1');
    expect(message).not.toMatch(/https?:/);
    expect(message).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });

  it('blames credentials only on a real 401', () => {
    expect(describeApiError(axiosError({status: 401}))).toMatch(/do not match an account/i);
  });

  it('distinguishes a timeout from an unreachable server', () => {
    const timeout = describeApiError(axiosError({code: 'ECONNABORTED'}));

    expect(timeout).toMatch(/taking longer/i);
    expect(timeout).not.toBe(describeApiError(axiosError({})));
    // The seconds used to be in here. A number nobody chose is a number
    // nobody can act on.
    expect(timeout).not.toMatch(/\d/);
  });

  it('reports a server fault without the status code or the word bug', () => {
    const message = describeApiError(axiosError({status: 500}));

    expect(message).toMatch(/our end/i);
    expect(message).not.toMatch(/500/);
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
