import {apiClient} from '../../api/client';
import {endpoints} from '../../api/endpoints';
import type {Role} from '../../types/roles';
import type {TokenPairResponse, User} from '../../types/api';

export async function login(email: string, password: string): Promise<TokenPairResponse> {
  const {data} = await apiClient.post<TokenPairResponse>(endpoints.auth.login, {email, password});
  return data;
}

export async function fetchMe(): Promise<User> {
  const {data} = await apiClient.get<User>(endpoints.auth.me);
  return data;
}

export async function logout(refresh: string): Promise<void> {
  await apiClient.post(endpoints.auth.logout, {refresh});
}

export type RegisterPayload = {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  role: Role;
  /** Required for an ADMIN account; optional for STAFF, where it joins a restaurant. */
  invite_code?: string;
};

export async function register(payload: RegisterPayload): Promise<User> {
  const {data} = await apiClient.post<User>(endpoints.auth.register, payload);
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
