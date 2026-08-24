import axios, {AxiosError, type InternalAxiosRequestConfig} from 'axios';

import {env} from '../config/env';
import {tokenStorage} from './tokenStorage';

/**
 * The single axios instance every feature uses.
 *
 * Responsibilities:
 *  - attach the access token to outgoing requests
 *  - refresh once on a 401 and replay the original request
 *  - queue concurrent requests during a refresh so one refresh serves them all
 */
export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeoutMs,
  headers: {'Content-Type': 'application/json'},
});

apiClient.interceptors.request.use(async config => {
  const token = await tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & {_retry?: boolean};

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = await tokenStorage.getRefreshToken();
  if (!refresh) {
    return null;
  }

  try {
    // Bare axios, not apiClient - the interceptor must not recurse.
    const {data} = await axios.post<{access: string; refresh?: string}>(
      `${env.apiBaseUrl}/auth/refresh/`,
      {refresh},
      {timeout: env.apiTimeoutMs},
    );
    await tokenStorage.setTokens({access: data.access, refresh: data.refresh ?? refresh});
    return data.access;
  } catch {
    await tokenStorage.clear();
    return null;
  }
}

apiClient.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;

    if (error.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;

    // Collapse parallel 401s into a single refresh call.
    refreshPromise = refreshPromise ?? refreshAccessToken();
    const newAccess = await refreshPromise;
    refreshPromise = null;

    if (!newAccess) {
      return Promise.reject(error);
    }

    original.headers.Authorization = `Bearer ${newAccess}`;
    return apiClient(original);
  },
);
