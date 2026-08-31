import {apiClient} from '../../api/client';
import {endpoints} from '../../api/endpoints';
import type {LoginResponse, User} from '../../types/api';

export async function login(email: string, password: string): Promise<LoginResponse> {
  const {data} = await apiClient.post<LoginResponse>(endpoints.auth.login, {email, password});
  return data;
}

export async function fetchMe(): Promise<User> {
  const {data} = await apiClient.get<User>(endpoints.auth.me);
  return data;
}

export async function logout(refresh: string): Promise<void> {
  await apiClient.post(endpoints.auth.logout, {refresh});
}
