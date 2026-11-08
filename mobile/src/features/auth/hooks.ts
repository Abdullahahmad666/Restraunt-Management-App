/** react-query wrapper: look up what an invite link is for, before sign-up. */
import {useQuery} from '@tanstack/react-query';

import {fetchDeletionPlan, fetchInviteInfo} from './api';

export function useInviteInfo(code: string | undefined) {
  return useQuery({
    queryKey: ['invite-info', code],
    queryFn: () => fetchInviteInfo(code as string),
    enabled: Boolean(code),
    retry: false,
  });
}

/**
 * What deleting this account would do.
 *
 * Fetched when the danger zone is opened rather than on screen load: it is
 * two counting queries server-side, and most visits to the profile screen are
 * not somebody about to delete their account.
 */
export function useDeletionPlan(enabled: boolean) {
  return useQuery({
    queryKey: ['deletion-plan'],
    queryFn: fetchDeletionPlan,
    enabled,
    // Counts drift as the restaurant is used, and this one is read at the
    // moment of a decision.
    staleTime: 0,
    retry: false,
  });
}
