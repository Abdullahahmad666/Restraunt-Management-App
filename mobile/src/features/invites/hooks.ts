/** react-query wrappers: list, issue and revoke staff invite links. */
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import * as api from './api';

const keys = {
  list: ['invite-codes'] as const,
};

export function useInviteCodes() {
  return useQuery({queryKey: keys.list, queryFn: api.listInviteCodes});
}

export function useCreateStaffInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createStaffInvite,
    onSuccess: () => queryClient.invalidateQueries({queryKey: keys.list}),
  });
}

export function useRevokeInviteCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.revokeInviteCode,
    onSuccess: () => queryClient.invalidateQueries({queryKey: keys.list}),
  });
}
