/** react-query wrappers: list, add and edit the restaurant's staff accounts. */
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import * as api from './api';

const keys = {
  list: ['staff-accounts'] as const,
};

export function useStaffAccounts() {
  return useQuery({queryKey: keys.list, queryFn: api.listStaff});
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createStaff,
    onSuccess: () => queryClient.invalidateQueries({queryKey: keys.list}),
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({id, ...input}: api.UpdateStaffInput & {id: string}) => api.updateStaff(id, input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: keys.list}),
  });
}
