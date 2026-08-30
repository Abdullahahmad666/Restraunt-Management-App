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
export function describeApiError(error: unknown, fallback = 'Something went wrong.'): string {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return `The server took too long to answer (${
      env.apiTimeoutMs / 1000
    }s). It may be starting up, or on a different network.`;
  }

  // Request went out, nothing came back: wrong address, server down, phone on
  // a different network, or a firewall in the way. Naming the address it tried
  // is the single most useful thing we can say here - a stale LAN IP after a
  // new DHCP lease is by far the most common cause.
  if (!error.response) {
    return `Cannot reach the server at ${env.apiBaseUrl}. Check that the backend is running and that this address is still correct.`;
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
    return `The server hit an error (${status}). This is a bug, not something you did.`;
  }

  // 400-level: surface the field message DRF actually sent rather than inventing one.
  if (body?.detail) {
    return body.detail;
  }
  const firstField = body && Object.entries(body).find(([, v]) => Array.isArray(v) && v.length);
  if (firstField) {
    return (firstField[1] as string[])[0] ?? fallback;
  }

  return fallback;
}

/** True when the request never reached the server - useful for offering a retry. */
export function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response;
}
