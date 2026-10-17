import axios from 'axios';

import {env} from '../config/env';
import type {ApiErrorBody} from '../types/api';

/**
 * Turn an unknown thrown value into something worth showing a user.
 *
 * The point is to never again say "check your password" when the real problem
 * is that the phone cannot reach the server. Those two failures look identical
 * to a `catch` block but need completely different actions, and guessing wrong
 * costs whoever is debugging it an afternoon.
 */
/**
 * The part that helps whoever is debugging, kept away from whoever is cooking.
 *
 * A stale LAN IP after a new DHCP lease is still the most common cause of a
 * dead connection in development, and the address we tried is the fastest way
 * to spot it - but it means nothing to a manager in a kitchen, and an error
 * naming an internal address reads as the app being broken rather than the
 * wifi being out.
 */
function logForDeveloper(detail: string, error: unknown): void {
  if (__DEV__) {
    console.warn(`[api] ${detail}`, error);
  }
}

/** invite_code -> "Invite code", so a field name can be shown to a person. */
function humanise(field: string): string {
  const spaced = field.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function describeApiError(error: unknown, fallback = 'Something went wrong.'): string {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    logForDeveloper(`Request timed out after ${env.apiTimeoutMs}ms`, error);
    return 'That is taking longer than it should. Check your connection and try again.';
  }

  // Request went out, nothing came back: no signal, server down, phone on a
  // different network, or a firewall in the way. Indistinguishable from here,
  // and only one of them is the user's to do anything about - so they get the
  // one sentence that covers all of it, and the address we tried goes to the
  // console, where the person who needs it is looking.
  if (!error.response) {
    logForDeveloper(`Could not reach ${env.apiBaseUrl}`, error);
    return 'No connection. Check your internet and try again.';
  }

  const {status, data} = error.response;

  // The scan endpoint's own errors (bad/inactive QR, outside the geofence,
  // wrong restaurant) come back as a plain array of strings instead of DRF's
  // usual {"field": [...]} shape.
  if (Array.isArray(data)) {
    const first: unknown = data[0];
    if (typeof first === 'string') {
      return first;
    }
  }

  const body = data as ApiErrorBody | undefined;

  if (status === 401) {
    return 'That email and password do not match an account.';
  }
  if (status === 403) {
    return 'Your account does not have access to this.';
  }
  if (status === 429) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (status >= 500) {
    logForDeveloper(`Server returned ${status}`, error);
    // "At our end" rather than a status code: the one thing worth telling
    // somebody is that it is not theirs to fix.
    return 'Something went wrong at our end. Try again in a moment.';
  }

  // 400-level: surface what DRF actually said rather than inventing a message.
  if (body?.detail) {
    return body.detail;
  }

  // non_field_errors is the whole-form case - "Please verify your email before
  // logging in" arrives here - and needs no field name in front of it.
  const formLevel = body?.non_field_errors;
  if (Array.isArray(formLevel) && typeof formLevel[0] === 'string') {
    return formLevel[0];
  }

  const firstField = body && Object.entries(body).find(([, v]) => Array.isArray(v) && v.length);
  if (firstField) {
    const [field, messages] = firstField;
    const message = (messages as string[])[0];
    if (!message) {
      return fallback;
    }
    // Name the field, because a bare "This field is required." on a form with
    // six inputs tells someone nothing about which one to look at.
    return `${humanise(field)}: ${message}`;
  }

  return fallback;
}

/** True when the request never reached the server - useful for offering a retry. */
export function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response;
}
