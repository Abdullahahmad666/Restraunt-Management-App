/** An invite code, as seen by the admin who issued it. */
import type {Role} from '../../types/roles';

export type InviteCode = {
  id: string;
  code: string;
  role: Role;
  restaurant: string;
  expires_at: string;
  used_at: string | null;
  is_usable: boolean;
  created_at: string;
};
