import axios from 'axios';

import {apiClient} from '../../api/client';
import {env} from '../../config/env';
import {endpoints} from '../../api/endpoints';
import type {LoginResponse, Role, User} from '../../types/api';

export async function login(email: string, password: string): Promise<LoginResponse> {
  const {data} = await apiClient.post<LoginResponse>(endpoints.auth.login, {email, password});
  return data;
}

export async function fetchMe(): Promise<User> {
  const {data} = await apiClient.get<User>(endpoints.auth.me);
  return data;
}

/**
 * Blacklist a refresh token server-side.
 *
 * Uses bare axios rather than apiClient on purpose. Through the shared client a
 * 401 here triggers the response interceptor, which refreshes - rotating the
 * very token this request is trying to blacklist, and producing a second,
 * confusing 401 in the server log right after the first.
 *
 * A rejection is swallowed because the goal is "this token can no longer be
 * used". If the server says the token is already invalid, that goal is met -
 * failing here would only stop someone signing out on their own device.
 */
export async function logout(refresh: string): Promise<void> {
  try {
    await axios.post(
      `${env.apiBaseUrl}${endpoints.auth.logout}`,
      {refresh},
      {timeout: env.apiTimeoutMs, headers: {'Content-Type': 'application/json'}},
    );
  } catch {
    // Already expired, already blacklisted, or unreachable - all fine.
  }
}

export type RegisterPayload = {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role: Role;
  /** An existing restaurant's code. Optional for STAFF (an admin can attach
   * them later); for ADMIN it's one of two ways in - see restaurant_name. */
  invite_code?: string;
  /** No code and no restaurant yet: this is what creates one. ADMIN only -
   * ignored for STAFF, who join an existing restaurant or nothing at all. */
  restaurant_name?: string;
};

export async function register(payload: RegisterPayload): Promise<User> {
  const {data} = await apiClient.post<User>(endpoints.auth.register, payload);
  return data;
}

/**
 * Registering doesn't sign anyone in - the backend rejects a login attempt
 * for an account whose email isn't verified yet, so this must succeed first.
 */
export async function verifyEmail(email: string, otp: string): Promise<void> {
  await apiClient.post(endpoints.auth.verifyEmail, {email, otp});
}

/** What an invite link may say about itself before anyone has signed in. */
export type InviteInfo = {
  restaurant_name: string;
  invited_by_name: string;
  role: Role;
  is_usable: boolean;
};

export async function fetchInviteInfo(code: string): Promise<InviteInfo> {
  const {data} = await apiClient.get<InviteInfo>(endpoints.auth.inviteLookup(code));
  return data;
}

/**
 * Ask for a reset link. Always resolves for a well-formed address, whether or
 * not it has an account - the server answers identically on purpose, so that
 * this cannot be used to find out who works somewhere.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await apiClient.post(endpoints.auth.passwordReset, {email});
}

export async function confirmPasswordReset(params: {
  uid: string;
  token: string;
  newPassword: string;
}): Promise<void> {
  await apiClient.post(endpoints.auth.passwordResetConfirm, {
    uid: params.uid,
    token: params.token,
    new_password: params.newPassword,
  });
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await apiClient.post(endpoints.auth.changePassword, {
    old_password: oldPassword,
    new_password: newPassword,
  });
}

export type ProfileUpdate = {
  first_name?: string;
  last_name?: string;
  phone?: string;
};

/** Plain-field edits. JSON, because only the avatar needs multipart. */
export async function updateProfile(changes: ProfileUpdate): Promise<User> {
  const {data} = await apiClient.patch<User>(endpoints.auth.me, changes);
  return data;
}

/**
 * Upload a new avatar.
 *
 * React Native's FormData takes {uri, name, type} rather than a Blob, and the
 * Content-Type header must be left unset so the runtime can add the multipart
 * boundary - setting it by hand produces a body Django cannot parse.
 */
export async function uploadAvatar(uri: string): Promise<User> {
  const extension = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mime = extension === 'png' ? 'image/png' : 'image/jpeg';

  const form = new FormData();
  form.append('profile_picture', {
    uri,
    name: `avatar.${extension}`,
    type: mime,
  } as unknown as Blob);

  const {data} = await apiClient.patch<User>(endpoints.auth.me, form, {
    headers: {'Content-Type': 'multipart/form-data'},
    transformRequest: value => value,
  });
  return data;
}
