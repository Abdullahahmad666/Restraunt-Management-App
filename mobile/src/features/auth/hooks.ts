/** react-query wrapper: look up what an invite link is for, before sign-up. */
import {useQuery} from '@tanstack/react-query';

import {fetchInviteInfo} from './api';

export function useInviteInfo(code: string | undefined) {
  return useQuery({
    queryKey: ['invite-info', code],
    queryFn: () => fetchInviteInfo(code as string),
    enabled: Boolean(code),
    retry: false,
  });
}
