import {apiClient} from '../../api/client';
import {endpoints} from '../../api/endpoints';
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
