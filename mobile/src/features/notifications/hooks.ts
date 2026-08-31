/** react-query wrappers: my notifications, mark-read, restaurant-wide list. */
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import * as api from './api';

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
