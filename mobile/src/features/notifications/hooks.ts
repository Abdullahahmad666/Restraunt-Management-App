/** react-query wrappers: my notifications, mark-read, restaurant-wide list, device registration. */
import {useEffect, useRef} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import * as api from './api';
import {getExpoPushToken} from './push';
import type {DevicePlatform} from './types';

const keys = {
  mine: ['notifications', 'mine'] as const,
  all: ['notifications', 'all'] as const,
};

export function useMyNotifications() {
  return useQuery({queryKey: keys.mine, queryFn: api.myNotifications});
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.markRead,
    onSuccess: () => queryClient.invalidateQueries({queryKey: keys.mine}),
  });
}

export function useAllNotifications() {
  return useQuery({queryKey: keys.all, queryFn: api.allNotifications});
}

export function useRegisterDevice() {
  return useMutation({
    mutationFn: ({token, platform}: {token: string; platform: DevicePlatform}) =>
      api.registerDevice(token, platform),
  });
}

/**
 * Fetches this device's Expo push token and registers it with the backend,
 * once per signed-in session - so push notifications (shift reminders, a
 * manager's staff check-in/out alerts) actually have somewhere to go.
 *
 * Call this once near the app root, gated on `enabled` being true only once
 * a user is signed in - registering a token isn't useful, and the
 * permission prompt isn't welcome, before then.
 */
export function useRegisterPushToken(enabled: boolean): void {
  const registerDevice = useRegisterDevice();
  const attempted = useRef(false);

  useEffect(() => {
    if (!enabled || attempted.current) {
      return;
    }
    attempted.current = true;

    getExpoPushToken()
      .then(result => {
        if (result) {
          registerDevice.mutate(result);
        }
      })
      .catch(() => {
        // Best-effort: a missing push token just means this device won't
        // get pushes, not a reason to disrupt anything else in the app.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
